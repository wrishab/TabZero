import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Trash2, 
  Pin, 
  PinOff,
  Globe,
  Save,
  History,
  Edit2,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';

// --- TYPES ---
type Tab = {
  id: string;
  title: string;
  url: string;
  category: string;
  favicon: string;
  pinned?: boolean;
};

type Session = {
  id: string;
  name: string;
  tabs: Tab[];
  date: string;
};

const CHROME_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'] as const;
type ChromeColor = typeof CHROME_COLORS[number];

const UI_PALETTE: Record<ChromeColor, { bg: string, border: string, text: string, textHover: string, dot: string, hex: string }> = {
  grey: { bg: 'hover:bg-[#64748b]/10 hover:border-l-[#64748b]/50', border: 'border-l-[#64748b]/50', text: 'text-[#94a3b8]', textHover: 'group-hover:text-[#94a3b8]', dot: 'bg-[#64748b]', hex: '#64748b' },
  blue: { bg: 'hover:bg-[#3b82f6]/10 hover:border-l-[#3b82f6]/50', border: 'border-l-[#3b82f6]/50', text: 'text-[#60a5fa]', textHover: 'group-hover:text-[#60a5fa]', dot: 'bg-[#3b82f6]', hex: '#3b82f6' },
  red: { bg: 'hover:bg-[#ef4444]/10 hover:border-l-[#ef4444]/50', border: 'border-l-[#ef4444]/50', text: 'text-[#f87171]', textHover: 'group-hover:text-[#f87171]', dot: 'bg-[#ef4444]', hex: '#ef4444' },
  yellow: { bg: 'hover:bg-[#eab308]/10 hover:border-l-[#eab308]/50', border: 'border-l-[#eab308]/50', text: 'text-[#facc15]', textHover: 'group-hover:text-[#facc15]', dot: 'bg-[#eab308]', hex: '#eab308' },
  green: { bg: 'hover:bg-[#22c55e]/10 hover:border-l-[#22c55e]/50', border: 'border-l-[#22c55e]/50', text: 'text-[#4ade80]', textHover: 'group-hover:text-[#4ade80]', dot: 'bg-[#22c55e]', hex: '#22c55e' },
  pink: { bg: 'hover:bg-[#ec4899]/10 hover:border-l-[#ec4899]/50', border: 'border-l-[#ec4899]/50', text: 'text-[#f472b6]', textHover: 'group-hover:text-[#f472b6]', dot: 'bg-[#ec4899]', hex: '#ec4899' },
  purple: { bg: 'hover:bg-[#a855f7]/10 hover:border-l-[#a855f7]/50', border: 'border-l-[#a855f7]/50', text: 'text-[#c084fc]', textHover: 'group-hover:text-[#c084fc]', dot: 'bg-[#a855f7]', hex: '#a855f7' },
  cyan: { bg: 'hover:bg-[#06b6d4]/10 hover:border-l-[#06b6d4]/50', border: 'border-l-[#06b6d4]/50', text: 'text-[#22d3ee]', textHover: 'group-hover:text-[#22d3ee]', dot: 'bg-[#06b6d4]', hex: '#06b6d4' },
  orange: { bg: 'hover:bg-[#f97316]/10 hover:border-l-[#f97316]/50', border: 'border-l-[#f97316]/50', text: 'text-[#fb923c]', textHover: 'group-hover:text-[#fb923c]', dot: 'bg-[#f97316]', hex: '#f97316' },
};

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [originalTabs, setOriginalTabs] = useState<Tab[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isOrganized, setIsOrganized] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [showToast, setShowToast] = useState('');
  const [showTabs, setShowTabs] = useState(false);
  const [showClearPicker, setShowClearPicker] = useState(false);
  const [selectedClearTabIds, setSelectedClearTabIds] = useState<Set<string>>(new Set());
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [organizedGroups, setOrganizedGroups] = useState<Record<string, { id: number, title: string, color: any }>>({});

  // Chrome Extension Initialization
  useEffect(() => {
    const chrome = (window as any).chrome;
    if (chrome && chrome.tabs && chrome.tabs.query) {
      // Load real tabs
      chrome.tabs.query({}, (chromeTabs: any[]) => {
        const formattedTabs: Tab[] = chromeTabs.map(t => ({
          id: String(t.id),
          title: t.title || 'Untitled',
          url: t.url || '',
          category: categorizeTab(t.url || '', t.title || ''),
          favicon: t.favIconUrl || '🌐',
          pinned: t.pinned || false
        }));
        setTabs(formattedTabs.filter(t => !t.url.startsWith('chrome://')));
      });

      // Load status from storage
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['isOrganized', 'tabZeroSessions'], (result: any) => {
          if (result.isOrganized !== undefined) {
            setIsOrganized(result.isOrganized);
          }
          if (result.tabZeroSessions) {
            setSessions(result.tabZeroSessions);
          }
        });
      }
    }
  }, []);

  const handleUpdateGroup = (categoryId: string, title: string, color: any) => {
    const group = organizedGroups[categoryId];
    if (!group) return;

    const newGroups = { ...organizedGroups, [categoryId]: { ...group, title, color } };
    setOrganizedGroups(newGroups);

    const chrome = (window as any).chrome;
    if (chrome && chrome.tabGroups) {
      chrome.tabGroups.update(group.id, { title, color });
    }
  };

  const handleTogglePin = (id: string, currentlyPinned: boolean) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, pinned: !t.pinned } : t));
    const chrome = (window as any).chrome;
    if (chrome && chrome.tabs) {
      const tabId = parseInt(id, 10);
      if (!isNaN(tabId)) chrome.tabs.update(tabId, { pinned: !currentlyPinned });
    }
  };

  const handleSaveSession = () => {
    if (tabs.length === 0) {
      setShowToast('No tabs to save');
      return;
    }
    
    // Check for exact duplicate session (same URLs and pinned states)
    const currentTabsFingerprint = tabs.map(t => `${t.url}|${!!t.pinned}`).join(',');
    
    const existingSessionIndex = sessions.findIndex(s => {
      const sessionFingerprint = s.tabs.map(t => `${t.url}|${!!t.pinned}`).join(',');
      return sessionFingerprint === currentTabsFingerprint;
    });

    const now = new Date();
    const name = `Session ${now.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    let updatedSessions: Session[];
    
    if (existingSessionIndex !== -1) {
      // It's a duplicate. Remove the old one and put a "refreshed" version at top
      const existingSession = sessions[existingSessionIndex];
      const newSession: Session = {
        ...existingSession,
        date: now.toISOString()
      };
      
      updatedSessions = [newSession, ...sessions.filter((_, i) => i !== existingSessionIndex)];
      setShowToast('✨ Refreshed existing session');
    } else {
      // Truly new session
      const newSession: Session = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        tabs: [...tabs],
        date: now.toISOString()
      };
      updatedSessions = [newSession, ...sessions];
      setShowToast('💾 Session saved');
    }
    
    setSessions(updatedSessions);
    
    const chrome = (window as any).chrome;
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ tabZeroSessions: updatedSessions });
    }
  };

  const handleRenameSession = (id: string, newName: string) => {
    const updatedSessions = sessions.map(s => s.id === id ? { ...s, name: newName } : s);
    setSessions(updatedSessions);
    setEditingSessionId(null);
    
    const chrome = (window as any).chrome;
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ tabZeroSessions: updatedSessions });
    }
    setShowToast('✏️ Session renamed');
  };

  const handleClearOthers = (specificIds?: string[]) => {
    const chrome = (window as any).chrome;
    if (chrome && chrome.tabs) {
      if (specificIds) {
        // Clear manually selected tabs
        const ids = specificIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (ids.length > 0) {
          chrome.tabs.remove(ids);
          setShowToast(`🧹 Cleared ${ids.length} selected tabs`);
          setSelectedClearTabIds(new Set());
          setShowClearPicker(false);
        }
      } else {
        // Default: Clear all other tabs
        chrome.tabs.query({ active: false, currentWindow: true }, (tabsToClose: any[]) => {
          const ids = tabsToClose.map(t => t.id).filter(id => id !== undefined);
          if (ids.length > 0) {
            chrome.tabs.remove(ids);
            setShowToast(`🧹 Cleared ${ids.length} other tabs`);
          }
        });
      }
      
      // Update state in either case
      setTimeout(() => {
        chrome.tabs.query({}, (chromeTabs: any[]) => {
          const formattedTabs: Tab[] = chromeTabs.map(t => ({
            id: String(t.id),
            title: t.title || 'Untitled',
            url: t.url || '',
            category: categorizeTab(t.url || '', t.title || ''),
            favicon: t.favIconUrl || '🌐',
            pinned: t.pinned || false
          }));
          setTabs(formattedTabs.filter(t => !t.url.startsWith('chrome://')));
        });
      }, 200);
    } else {
      setShowToast('Clear only works in extension mode');
    }
  };

  const handleRestoreSession = (session: Session) => {
    const chrome = (window as any).chrome;
    if (chrome && chrome.tabs) {
      session.tabs.forEach(tab => {
        chrome.tabs.create({ url: tab.url, active: false, pinned: tab.pinned });
      });
      setShowToast(`🔄 Restored ${session.name}`);
    } else {
      setShowToast('Restoration only works in extension mode');
    }
  };

  const handleDeleteSession = (id: string) => {
    const updatedSessions = sessions.filter(s => s.id !== id);
    setSessions(updatedSessions);
    const chrome = (window as any).chrome;
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ tabZeroSessions: updatedSessions });
    }
  };

  // Toast effect
  useEffect(() => {
    if (showToast) {
      const t = setTimeout(() => setShowToast(''), 2500);
      return () => clearTimeout(t);
    }
  }, [showToast]);

  const handleCleanTabs = () => {
    setIsOrganizing(true);
    setOriginalTabs([...tabs]);

    // Simulate thinking/scanning
    setTimeout(() => {
      // Remove duplicates logic
      const uniqueUrls = new Set<string>();
      const duplicateIds: string[] = [];
      const uniqueTabs: Tab[] = [];

      for (const tab of tabs) {
        if (tab.pinned) {
          uniqueTabs.push(tab);
          uniqueUrls.add(tab.url);
          continue;
        }

        if (uniqueUrls.has(tab.url)) {
          duplicateIds.push(tab.id);
        } else {
          uniqueUrls.add(tab.url);
          uniqueTabs.push(tab);
        }
      }

      const chrome = (window as any).chrome;
      if (chrome && chrome.tabs && duplicateIds.length > 0) {
        const realTabIds = duplicateIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (realTabIds.length > 0) {
          chrome.tabs.remove(realTabIds);
        }
      }
      
      // Calculate groups
      const unpinnedTabs = uniqueTabs.filter(t => !t.pinned);
      const grouped = groupTabsByCategory(unpinnedTabs);
      
      // Sorting and limiting to top 5 categories
      const order = getCategoryOrder();
      const sortedEntries = Object.entries(grouped).sort((a, b) => {
        const indexA = order.indexOf(a[0]);
        const indexB = order.indexOf(b[0]);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      }).slice(0, 5);

      const finalGroups = Object.fromEntries(sortedEntries) as Record<string, Tab[]>;

      // Group tabs in the browser automatically
      if (chrome && chrome.tabs && chrome.tabGroups) {
        chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs: any[]) => {
          const activeTabId = activeTabs[0]?.id;
          
          Object.entries(finalGroups).forEach(([categoryId, groupTabs]) => {
            const tabIds = groupTabs.map(t => parseInt(t.id, 10)).filter(id => !isNaN(id));
            if (tabIds.length > 0) {
              chrome.tabs.group({ tabIds }, (groupId: number) => {
                const hasActive = tabIds.includes(activeTabId);
                const color = getCategoryColor(categoryId);
                chrome.tabGroups.update(groupId, { 
                  title: categoryId, 
                  color: color as any,
                  collapsed: !hasActive 
                });
                setOrganizedGroups(prev => ({ 
                  ...prev, 
                  [categoryId]: { id: groupId, title: categoryId, color } 
                }));
              });
            }
          });
        });
      }

      setIsOrganized(true);
      setIsOrganizing(false);

      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ isOrganized: true });
      }
      setTabs(uniqueTabs);
    }, 1500);
  };

  const handleUnorganizeTabs = () => {
    setIsOrganizing(true);
    setTimeout(() => {
      const chrome = (window as any).chrome;
      if (chrome && chrome.tabs) {
        chrome.tabs.query({}, (currentTabs: any[]) => {
          const tabIds = currentTabs.map(t => t.id).filter(id => id !== undefined);
          if (tabIds.length > 0) {
            try {
              chrome.tabs.ungroup(tabIds);
              // Move all tabs to the beginning to reset order roughly
              chrome.tabs.move(tabIds, { index: 0 });
            } catch (e) {
              console.log("Ungroup failed", e);
            }
          }
          
          // Re-fetch current tabs to update state
          const formattedTabs: Tab[] = currentTabs.map(t => ({
            id: String(t.id),
            title: t.title || 'Untitled',
            url: t.url || '',
            category: categorizeTab(t.url || '', t.title || ''),
            favicon: t.favIconUrl || '🌐',
            pinned: t.pinned || false
          })).filter(t => !t.url.startsWith('chrome://'));
          
          setTabs(formattedTabs);
        });
      }
      
      setIsOrganized(false);
      setIsOrganizing(false);
      setOrganizedGroups({});
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ isOrganized: false });
      }
      setShowToast('🔄 Reset to unorganized');
    }, 1000);
  };

  const handleToggleOrganize = () => {
    if (isOrganized) {
      handleUnorganizeTabs();
    } else {
      handleCleanTabs();
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#020617] text-slate-300 font-sans overflow-hidden selection:bg-sky-500/30">
      
      {/* Top Header */}
      <header className="px-8 py-10 flex items-center justify-center shrink-0">
        <div className="flex items-center gap-3 opacity-90 hover:opacity-100 transition-all cursor-default">
          <div className="w-8 h-8 bg-gradient-to-br from-sky-400 to-teal-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-[10px] shadow-lg shadow-sky-500/20">
            Z0
          </div>
          <span className="font-extrabold text-lg text-white tracking-tighter">TabZero</span>
        </div>
      </header>

      {/* Main Focus Area */}
      <main className="flex-1 flex flex-col items-center justify-center relative px-8 pb-16">
        <div className="flex flex-col items-center max-w-xs text-center">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-extrabold text-white tracking-tightest mb-2 leading-tight">
              Organize in a click
            </h1>
            <p className="text-slate-500 text-base font-medium leading-relaxed">
              Smart AI grouping. Zero clutter.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center gap-6 w-full"
          >
            <motion.button 
              onClick={handleToggleOrganize}
              disabled={isOrganizing}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`group relative flex items-center h-[72px] w-[240px] rounded-full p-2 transition-all duration-500 overflow-hidden shadow-2xl ${
                isOrganized 
                ? 'bg-emerald-500 shadow-emerald-500/20' 
                : 'bg-white/[0.05] border border-white/10 shadow-black/40'
              }`}
            >
              {/* Handle */}
              <motion.div
                className="h-[56px] w-[56px] bg-white rounded-full shadow-xl flex items-center justify-center relative z-20 shrink-0"
                animate={{ x: isOrganized ? 168 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                {isOrganizing ? (
                  <div className="w-5 h-5 border-2 border-slate-900/20 border-t-slate-900 rounded-full animate-spin" />
                ) : (
                  <Sparkles size={22} className={isOrganized ? 'text-emerald-500' : 'text-slate-400'} />
                )}
              </motion.div>

              {/* Text Label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
                <motion.span 
                  animate={{ 
                    x: isOrganized ? -28 : 28,
                    opacity: isOrganizing ? 0.4 : 1
                  }}
                  className={`text-[12px] font-black uppercase tracking-[0.25em] transition-colors duration-500 ${
                    isOrganized ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  {isOrganizing ? 'Syncing...' : (isOrganized ? 'Organized' : 'Unorganized')}
                </motion.span>
              </div>
            </motion.button>

            <div className="relative w-full flex flex-col items-center">
              <div className="flex items-center gap-2 w-full max-w-[240px]">
                <motion.button 
                  onClick={() => handleClearOthers()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 mt-4 flex items-center justify-center gap-2.5 px-6 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl font-bold text-xs border border-rose-500/30 transition-all shadow-lg shadow-rose-500/5 group/clear"
                >
                  <X size={14} className="opacity-70 group-hover/clear:opacity-100 transition-opacity" />
                  Clear All Others
                </motion.button>
                <motion.button
                  onClick={() => setShowClearPicker(!showClearPicker)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`mt-4 p-3 rounded-xl border transition-all ${
                    showClearPicker 
                    ? 'bg-rose-500 text-white border-rose-500' 
                    : 'bg-white/[0.03] text-slate-500 border-white/10 hover:border-white/20'
                  }`}
                >
                  <ChevronDown size={14} className={`transition-transform duration-300 ${showClearPicker ? 'rotate-180' : ''}`} />
                </motion.button>
              </div>

              <AnimatePresence>
                {showClearPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute top-full mt-2 w-full max-w-[280px] glass-card rounded-2xl shadow-2xl p-4 z-40 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-3 px-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Manual Select</span>
                      {selectedClearTabIds.size > 0 && (
                        <button 
                          onClick={() => handleClearOthers(Array.from(selectedClearTabIds))}
                          className="text-[9px] font-black uppercase text-rose-400 hover:text-rose-300 transition-colors"
                        >
                          Clear ({selectedClearTabIds.size})
                        </button>
                      )}
                    </div>
                    
                    <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                      {tabs.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => {
                            const next = new Set(selectedClearTabIds);
                            if (next.has(tab.id)) next.delete(tab.id);
                            else next.add(tab.id);
                            setSelectedClearTabIds(next);
                          }}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-left group ${
                            selectedClearTabIds.has(tab.id) ? 'bg-rose-500/10' : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center shrink-0 ${
                            selectedClearTabIds.has(tab.id) 
                            ? 'bg-rose-500 border-rose-500 text-white' 
                            : 'border-white/20 group-hover:border-white/40'
                          }`}>
                            {selectedClearTabIds.has(tab.id) && <X size={10} strokeWidth={4} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[10px] font-bold truncate ${selectedClearTabIds.has(tab.id) ? 'text-rose-400' : 'text-slate-300'}`}>
                              {tab.title}
                            </p>
                            <p className="text-[8px] text-slate-600 truncate">{tab.url}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button 
              onClick={handleSaveSession}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-2 flex items-center gap-3 px-6 py-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-xl font-bold text-xs border border-sky-500/30 transition-all shadow-lg shadow-sky-500/5 group/save"
            >
              <Save size={16} className="opacity-70 group-hover/save:opacity-100 transition-opacity" />
              Save Current Session
            </motion.button>

            <button 
              onClick={() => setShowTabs(!showTabs)}
              className="mt-2 px-4 py-2 bg-white/[0.03] hover:bg-white/10 active:bg-white/[0.05] border border-white/[0.05] hover:border-white/20 rounded-full text-slate-400 hover:text-white transition-all flex items-center gap-2 group/btn"
            >
              <span className="text-[9px] font-bold uppercase tracking-[0.1em]">
                {showTabs ? 'Hide Tabs' : 'Review Tabs'}
              </span>
              {showTabs ? (
                <ChevronUp size={12} className="opacity-60 group-hover/btn:translate-y-[-1px] transition-transform" />
              ) : (
                <ChevronDown size={12} className="opacity-60 group-hover/btn:translate-y-[1px] transition-transform" />
              )}
            </button>

            <AnimatePresence>
              {showTabs && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="w-full mt-4 overflow-hidden"
                >
                  {/* Active Tabs Review */}
                  <div className="mb-4">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-2 text-left">Active Workspace</p>

                    <div className="glass-card rounded-[20px] overflow-hidden divide-y divide-white/[0.03] text-left max-h-[240px] overflow-y-auto custom-scrollbar">
                      <div className="divide-y divide-white/[0.03]">
                        {!isOrganized ? (
                          tabs.map((tab: Tab) => (
                            <React.Fragment key={tab.id}>
                              <TabRow 
                                tab={tab} 
                                onTogglePin={handleTogglePin} 
                              />
                            </React.Fragment>
                          ))
                        ) : (
                          (() => {
                            const unpinned = tabs.filter(t => !t.pinned);
                            const grouped = groupTabsByCategory(unpinned);

                            return (
                              <>
                                {/* Pinned Section */}
                                {tabs.filter(t => t.pinned).length > 0 && (
                                  <div className="bg-white/[0.02]">
                                    <div className="px-4 py-2 flex items-center gap-2 border-b border-white/[0.03]">
                                      <Pin size={10} className="text-sky-400" />
                                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Pinned</span>
                                    </div>
                                    {tabs.filter(t => t.pinned).map(tab => (
                                      <React.Fragment key={tab.id}>
                                        <TabRow 
                                          tab={tab} 
                                          onTogglePin={handleTogglePin} 
                                        />
                                      </React.Fragment>
                                    ))}
                                  </div>
                                )}
                                {/* Categories */}
                                {(Object.entries(grouped) as [string, Tab[]][]).map(([categoryId, groupTabs]) => (
                                  <div key={categoryId}>
                                    <div className="px-4 py-3 flex flex-col gap-2 border-b border-white/[0.03] bg-white/[0.01]">
                                      <div className="flex items-center gap-2">
                                        {organizedGroups[categoryId] ? (
                                          <div className="flex flex-col gap-2 w-full">
                                            <div className="flex items-center gap-2">
                                              <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: UI_PALETTE[organizedGroups[categoryId].color as ChromeColor]?.hex || UI_PALETTE.grey.hex }} />
                                              <input 
                                                value={organizedGroups[categoryId].title}
                                                onChange={(e) => handleUpdateGroup(categoryId, e.target.value, organizedGroups[categoryId].color)}
                                                className="bg-transparent border-none text-[10px] font-bold tracking-wider text-slate-300 focus:outline-none focus:text-white transition-colors flex-1"
                                                placeholder="Group Name"
                                              />
                                              <span className="text-[9px] text-slate-600 font-medium ml-auto flex items-center justify-center bg-white/[0.03] px-2 py-0.5 rounded-full border border-white/[0.05]">{groupTabs.length} tabs</span>
                                            </div>
                                            <div className="flex gap-1.5 ml-4">
                                              {CHROME_COLORS.map(c => (
                                                <button
                                                  key={c}
                                                  onClick={() => handleUpdateGroup(categoryId, organizedGroups[categoryId].title, c)}
                                                  className={`w-2.5 h-2.5 rounded-full border ${organizedGroups[categoryId].color === c ? 'border-white scale-110 shadow-sm shadow-white/20' : 'border-transparent'} transition-all hover:scale-125`}
                                                  style={{ backgroundColor: UI_PALETTE[c]?.hex }}
                                                />
                                              ))}
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: UI_PALETTE[getCategoryColor(categoryId)]?.hex || UI_PALETTE.grey.hex }} />
                                            <span className="text-[10px] font-bold tracking-wider text-slate-300">{categoryId}</span>
                                            <span className="text-[9px] text-slate-600 font-medium ml-auto flex items-center justify-center bg-white/[0.03] px-2 py-0.5 rounded-full border border-white/[0.05]">{groupTabs.length} tabs</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {groupTabs.map((tab: Tab) => (
                                      <React.Fragment key={tab.id}>
                                        <TabRow 
                                          tab={tab} 
                                          onTogglePin={handleTogglePin} 
                                          themeColor={(organizedGroups[categoryId]?.color as ChromeColor) || getCategoryColor(categoryId)}
                                        />
                                      </React.Fragment>
                                    ))}
                                  </div>
                                ))}
                              </>
                            );
                          })()
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Saved Sessions */}
            {sessions.length > 0 && (
              <div className="w-full mt-6">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-2 text-left">Saved Sessions</p>
                <div className="glass-card rounded-[20px] overflow-hidden divide-y divide-white/[0.03] text-left max-h-[200px] overflow-y-auto custom-scrollbar">
                  {sessions.map(session => (
                    <div key={session.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-all group">
                      <div className="flex-1 min-w-0 mr-4">
                        {editingSessionId === session.id ? (
                          <input 
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => handleRenameSession(session.id, editingName)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameSession(session.id, editingName);
                              if (e.key === 'Escape') setEditingSessionId(null);
                            }}
                            className="w-full bg-white/10 border-none text-sm font-bold text-white focus:outline-none rounded px-1 py-0.5"
                          />
                        ) : (
                          <p className="text-sm font-bold text-white truncate">{session.name}</p>
                        )}
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{session.tabs.length} tabs</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button 
                          onClick={() => {
                            setEditingSessionId(session.id);
                            setEditingName(session.name);
                          }} 
                          className="p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-all"
                          title="Rename Session"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleRestoreSession(session)} 
                          className="p-2 text-sky-400 hover:bg-sky-400/10 rounded-lg transition-all"
                          title="Restore Session"
                        >
                          <History size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteSession(session.id)} 
                          className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                          title="Delete Session"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Syncing Overlay */}
      <AnimatePresence>
        {isOrganizing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#020617]/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div 
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: [0, 90, 180, 270, 360]
              }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              className="w-24 h-24 mb-10 relative flex items-center justify-center font-black"
            >
              <div className="absolute inset-0 rounded-[28px] border-t-2 border-sky-400 opacity-20" />
              <div className="absolute inset-4 rounded-[20px] border-t-2 border-teal-400 opacity-40 animate-spin" />
              <div className="text-white text-2xl tracking-tighter">Z0</div>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h2 className="text-2xl font-extrabold text-white mb-3 tracking-tight">Syncing Workspace</h2>
              <p className="text-slate-500 font-medium text-sm">Organizing your digital mind...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white text-black px-4 py-2.5 rounded-full text-xs font-semibold shadow-2xl z-50 flex items-center gap-2 whitespace-nowrap border border-white/20"
          >
            {showToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-component for a tab row
function TabRow({ 
  tab, 
  onTogglePin,
  themeColor
}: { 
  tab: Tab, 
  onTogglePin: (id: string, currentlyPinned: boolean) => void,
  themeColor?: ChromeColor
}) {
  const colorScheme = themeColor ? UI_PALETTE[themeColor] : UI_PALETTE.grey;
  
  return (
    <div className={`flex items-center gap-4 py-2.5 px-4 transition-all group relative border-l-[3px] border-transparent ${
      themeColor ? colorScheme.bg + ' ' + colorScheme.border : 'hover:bg-white/[0.04] hover:border-white/10'
    }`}>
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        {tab.favicon.startsWith('http') || tab.favicon.startsWith('data:') ? (
          <img src={tab.favicon} className="w-4 h-4 rounded-sm opacity-80 group-hover:opacity-100 transition-opacity" alt="" referrerPolicy="no-referrer" />
        ) : (
          <Globe size={14} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="text-[12px] font-medium text-slate-300 truncate leading-tight group-hover:text-white transition-colors">{tab.title || 'Untitled'}</p>
        <p className={`text-[10px] truncate ${themeColor ? colorScheme.textHover : ''} ${!themeColor ? 'text-slate-600' : colorScheme.text + ' opacity-70 group-hover:opacity-100'}`}>{tab.url}</p>
      </div>

      <button 
        onClick={() => onTogglePin(tab.id, !!tab.pinned)}
        className={`p-2 rounded-xl transition-all border shrink-0 opacity-0 group-hover:opacity-100 ${
          tab.pinned 
          ? 'text-sky-400 bg-sky-400/15 border-sky-400/30' 
          : 'text-slate-500 bg-white/[0.03] border-white/[0.05] hover:text-slate-300 hover:bg-white/10 hover:border-white/20'
        }`}
        title={tab.pinned ? 'Unpin tab' : 'Pin tab'}
      >
        {tab.pinned ? <Pin size={12} className="fill-current" /> : <Pin size={12} />}
      </button>
    </div>
  );
}

// --- HELPERS ---

function groupTabsByCategory(tabsToGroup: Tab[]): Record<string, Tab[]> {
  const groups: Record<string, Tab[]> = {};
  tabsToGroup.forEach(tab => {
    const category = categorizeTab(tab.url, tab.title);
    if (!groups[category]) groups[category] = [];
    groups[category].push(tab);
  });

  // If user already has developer category organized then all ai ones will be in developer category
  if (groups['Developer'] && groups['AI']) {
    groups['Developer'] = [...groups['Developer'], ...groups['AI']];
    delete groups['AI'];
  }
  
  return groups;
}

function categorizeTab(url: string, title?: string): string {
  if (!url) return 'Others';
  const l = url.toLowerCase();
  const t = title?.toLowerCase() || '';

  if (l.includes('youtube.com')) {
    const learningKeywords = ['lecture', 'tutorial', 'course', 'explainer', 'how to', 'education', 'physics', 'math', 'science', 'coding', 'programming'];
    if (learningKeywords.some(key => t.includes(key))) return 'Study';
    return 'Entertainment';
  }

  const rules: Record<string, string[]> = {
    'Developer': [
      'github.com', 'gitlab.com', 'bitbucket.org', 'sourceforge.net', 'codeberg.org', 'replit.com', 
      'codepen.io', 'jsfiddle.net', 'stackoverflow.com', 'stackexchange.com', 'dev.to', 'hashnode.com', 
      'hackerrank.com', 'leetcode.com', 'codeforces.com', 'atcoder.jp', 'topcoder.com', 
      'geeksforgeeks.org', 'hackerearth.com', 'codingame.com', 'freecodecamp.org', 
      'developer.mozilla.org', 'w3schools.com', 'tutorialspoint.com', 'programiz.com', 
      'codecademy.com', 'coursera.org', 'edx.org', 'udemy.com', 'pluralsight.com', 
      'khanacademy.org', 'ocw.mit.edu', 'jetbrains.com', 'visualstudio.com', 'code.visualstudio.com', 
      'postman.com', 'insomnia.rest', 'docker.com', 'kubernetes.io', 'terraform.io', 'ansible.com', 
      'jenkins.io', 'netlify.com', 'vercel.com', 'heroku.com', 'firebase.google.com', 'supabase.com', 
      'aws.amazon.com', 'cloud.google.com', 'azure.microsoft.com', 'digitalocean.com', 
      'cloudflare.com', 'mongodb.com', 'redis.io', 'prisma.io', 'strapi.io', 'wordpress.org', 
      'nextjs.org', 'react.dev', 'angular.io', 'vuejs.org', 'tailwindcss.com', 'npmjs.com', 
      'pnpm.io', 'bun.sh', 'figma.com', 'trello.com', 'atlassian.net', 'asana.com', 'clickup.com', 
      'notion.so', 'slack.com', 'discord.com', 'linear.app', 'sentry.io', 'stripe.com', 'auth0.com',
      'localhost', 'npmtrends.com'
    ],
    'Study': [
      'wikipedia.org', 'researchgate.net', 'scholar.google.', 'byjus.com', 'unacademy.com'
    ],
    'AI': [
      'openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai', 'poe.com', 
      'you.com', 'phind.com', 'jasper.ai', 'copy.ai', 'writesonic.com', 'rytr.me', 'grammarly.com', 
      'quillbot.com', 'wordtune.com', 'sudowrite.com', 'midjourney.com', 'leonardo.ai', 
      'stablediffusionweb.com', 'firefly.adobe.com', 'ideogram.ai', 'playgroundai.com', 
      'runwayml.com', 'pictory.ai', 'synthesia.io', 'heygen.com', 'descript.com', 'luma.ai', 
      'kaiber.ai', 'elevenlabs.io', 'murf.ai', 'play.ht', 'speechify.com', 'aiva.ai', 
      'soundraw.io', 'boomy.com', 'codeium.com', 'tabnine.com', 'cursor.com', 'otter.ai', 
      'fireflies.ai', 'mem.ai', 'taskade.com', 'tome.app', 'looka.com', 'uizard.io', 
      'khroma.co', 'usegalileo.ai', 'durable.co', 'huggingface.co', 'stability.ai', 
      'cohere.com', 'anthropic.com', 'replicate.com', 'pinecone.io', 'wandb.ai', 
      'langchain.com', 'character.ai', 'reface.ai', 'remini.ai', 'cleanup.pictures', 
      'clipdrop.co', 'remove.bg', 'letsenhance.io', 'rundiffusion.com', 'krea.ai', 
      'scenario.com', 'dreamstudio.ai', 'promptbase.com', 'prompthero.com', 'futurepedia.io', 
      'theresanaiforthat.com', 'lexica.art', 'mage.space', 'nightcafe.studio', 'artbreeder.com', 
      'replika.ai', 'pi.ai', 'grok.com', 'bing.com/chat'
    ],
    'Work': [
      'docs.google.com', 'drive.google.com', 'sheets.google.com', 'slides.google.com', 
      'mail.google.com', 'outlook.live.com', 'office.com', 'monday.com', 'airtable.com', 
      'miro.com', 'zoom.us', 'meet.google.com', 'teams.microsoft.com'
    ],
    'Entertainment': [
      'netflix.com', 'twitch.tv', 'vimeo.com', 'spotify.com', 'primevideo.', 'hulu.com', 
      'disneyplus.com', 'soundcloud.com', 'hotstar.com', 'imdb.com'
    ],
    'Social': [
      'twitter.com', 'x.com', 'reddit.com', 'facebook.com', 'instagram.com', 'tiktok.com', 
      'discord.com', 'web.whatsapp.com', 'telegram.org', 'linkedin.com', 'snapchat.com', 'pinterest.com'
    ],
    'Shopping': [
      'amazon.', 'ebay.', 'shopify.', 'walmart.com', 'aliexpress.', 'target.com', 'bestbuy.com', 
      'etsy.com', 'flipkart.', 'myntra.', 'ajio.com', 'meesho.com', 'zara.com', 'hm.com', 'nike.com', 
      'adidas.com', 'apple.com/shop', 'homedepot.com', 'shein.com', 'temu.com', 'wayfair.com', 
      'costco.com', 'huckberry.com', 'shinesty.com', 'chewy.com', 'alibaba.com', 'lunya.co', 
      'beardbrand.com', 'beckettsimonon.com'
    ],
    'News': [
      'bbc.com', 'bbc.co.uk', 'ndtv.com', 'thehindu.com', 'cnn.com', 'news.google.', 'nytimes.com', 
      'usatoday.com', 'foxnews.com', 'washingtonpost.com', 'apnews.com', 'nbcnews.com', 'wsj.com', 
      'npr.org', 'newsbreak.com'
    ],
    'Travel': [
      'maps.google.', 'google.com/maps', 'makemytrip.com', 'booking.com', 'airbnb.', 
      'irctc.co.in', 'expedia.com', 'vrbo.com', 'tripadvisor.com', 'kayak.com'
    ],
    'Finance': [
      'paypal.com', 'phonepe.com', 'pay.google.com', 'zerodha.com', 'coinbase.com', 'coindcx.com', 
      'groww.in', 'angelone.in', 'upstox.com', 'schwab.com', 'fidelity.com', 'interactivebrokers.com'
    ]
  };

  for (const [category, domains] of Object.entries(rules)) {
    if (domains.some(domain => l.includes(domain))) return category;
  }

  // Extra keyword check for AI if no domain matched
  const aiKeywords = ['ai', 'chatgpt', 'gemini', 'claude', 'perplexity', 'poe', 'gpt-4', 'gpt-4o', 'llama', 'mistral', 'stable diffusion', 'midjourney', 'copilot', 'artificial intelligence', 'machine learning', 'deep learning'];
  if (aiKeywords.some(kw => l.includes(kw) || t.includes(kw))) return 'AI';

  // Extra keyword check for developer if no domain matched
  const developerKeywords = [
    'api', 'github', 'code', 'deploy', 'debugger', 'console', 'repository', 'branch', 'pull request',
    'docker', 'kubernetes', 'terraform', 'aws', 'cloud', 'database', 'sql', 'nosql', 'frontend', 
    'backend', 'fullstack', 'framework', 'library', 'documentation', 'programming', 'software',
    'jenkins', 'ci/cd', 'script', 'terminal', 'shell', 'npm', 'yarn', 'pnpm', 'bun'
  ];
  if (developerKeywords.some(kw => l.includes(kw) || t.includes(kw))) return 'Developer';

  // Extra keyword check for travel if no domain matched
  const travelKeywords = ['map', 'location', 'booking', 'hotel', 'flights', 'trip', 'vacation'];
  if (travelKeywords.some(kw => l.includes(kw) || t.includes(kw))) return 'Travel';

  // Extra keyword check for finance if no domain matched
  const financeKeywords = ['bank', 'pay', 'wallet', 'crypto', 'mutual funds'];
  if (financeKeywords.some(kw => l.includes(kw) || t.includes(kw))) return 'Finance';

  // Extra keyword check for news if no domain matched
  const newsKeywords = ['news', 'headlines', 'breaking'];
  if (newsKeywords.some(kw => l.includes(kw) || t.includes(kw))) return 'News';

  // Extra keyword check for entertainment if no domain matched
  const entertainmentKeywords = ['video', 'music', 'stream', 'watch', 'play', 'movie', 'song', 'playlist', 'trailer', 'episode'];
  if (entertainmentKeywords.some(kw => l.includes(kw) || t.includes(kw))) return 'Entertainment';

  // Extra keyword check for social if no domain matched
  const socialKeywords = ['chat', 'message', 'post', 'share', 'comment', 'dm', 'reel', 'story', 'profile', 'notification'];
  if (socialKeywords.some(kw => l.includes(kw) || t.includes(kw))) return 'Social';

  // Extra keyword check for work if no domain matched
  const workKeywords = ['docs', 'meeting', 'mail', 'project', 'task', 'office', 'workspace', 'sprint', 'deadline', 'kanban'];
  if (workKeywords.some(kw => l.includes(kw) || t.includes(kw))) return 'Work';

  // Extra keyword check for study if no domain matched
  const studyKeywords = ['lecture', 'tutorial', 'course', 'study', 'notes', 'research', 'coding', 'assignment', 'exam', 'pdf', 'syllabus', 'textbook'];
  if (studyKeywords.some(kw => l.includes(kw) || t.includes(kw))) return 'Study';

  // Extra keyword check for shopping if no domain matched
  const shoppingKeywords = ['buy', 'cart', 'checkout', 'order', 'deal', 'discount', 'offer', 'wishlist', 'payment', 'shop'];
  if (shoppingKeywords.some(kw => l.includes(kw) || t.includes(kw))) return 'Shopping';

  return 'Others';
}

function getCategoryColor(category: string): ChromeColor {
  const colors: Record<string, ChromeColor> = {
    'Study': 'green',
    'Work': 'blue',
    'Entertainment': 'red',
    'Social': 'pink',
    'Shopping': 'orange',
    'News': 'cyan',
    'Finance': 'yellow',
    'Developer': 'grey',
    'Travel': 'cyan',
    'AI': 'purple',
    'Others': 'grey'
  };
  return colors[category] || 'grey';
}

function getCategoryOrder(): string[] {
  return ['AI', 'Developer', 'Study', 'Work', 'Social', 'News', 'Finance', 'Travel', 'Shopping', 'Entertainment', 'Others'];
}
