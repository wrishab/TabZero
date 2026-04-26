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
  ChevronDown,
  ChevronUp
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

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [originalTabs, setOriginalTabs] = useState<Tab[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isOrganized, setIsOrganized] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [showToast, setShowToast] = useState('');
  const [showTabs, setShowTabs] = useState(false);
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
    
    const now = new Date();
    const name = `Session ${now.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    const newSession: Session = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      tabs: [...tabs],
      date: now.toISOString()
    };
    
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    
    const chrome = (window as any).chrome;
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ tabZeroSessions: updatedSessions });
    }
    setShowToast('💾 Session saved');
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
      const grouped = unpinnedTabs.reduce((acc, tab) => {
        const categoryId = categorizeTab(tab.url, tab.title);
        if (!acc[categoryId]) acc[categoryId] = [];
        acc[categoryId].push(tab);
        return acc;
      }, {} as Record<string, Tab[]>);
      
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
              Clean your tabs in 1 click
            </h1>
            <p className="text-slate-500 text-base font-medium leading-relaxed">
              Instantly group your tabs and remove duplicates.
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

            <motion.button 
              onClick={handleSaveSession}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-4 flex items-center gap-3 px-6 py-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-xl font-bold text-xs border border-sky-500/30 transition-all shadow-lg shadow-sky-500/5 group/save"
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

                    <div className="glass-card rounded-[20px] overflow-hidden divide-y divide-white/[0.03] text-left max-h-[240px] overflow-y-auto">
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
                            const grouped = tabs.reduce((acc, tab) => {
                              if (tab.pinned) return acc;
                              const categoryId = categorizeTab(tab.url, tab.title);
                              if (!acc[categoryId]) acc[categoryId] = [];
                              acc[categoryId].push(tab);
                              return acc;
                            }, {} as Record<string, Tab[]>);

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
                                              <div className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: organizedGroups[categoryId].color === 'grey' ? '#64748b' : organizedGroups[categoryId].color === 'cyan' ? '#06b6d4' : organizedGroups[categoryId].color }} />
                                              <input 
                                                value={organizedGroups[categoryId].title}
                                                onChange={(e) => handleUpdateGroup(categoryId, e.target.value, organizedGroups[categoryId].color)}
                                                className="bg-transparent border-none text-[8px] font-black uppercase tracking-wider text-slate-300 focus:outline-none focus:text-white transition-colors flex-1"
                                                placeholder="Group Name"
                                              />
                                              <span className="text-[8px] text-slate-600 font-medium ml-auto">{groupTabs.length} tabs</span>
                                            </div>
                                            <div className="flex gap-1.5 ml-3.5">
                                              {['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'].map(c => (
                                                <button
                                                  key={c}
                                                  onClick={() => handleUpdateGroup(categoryId, organizedGroups[categoryId].title, c)}
                                                  className={`w-2.5 h-2.5 rounded-full border ${organizedGroups[categoryId].color === c ? 'border-white' : 'border-transparent'} transition-all hover:scale-125`}
                                                  style={{ backgroundColor: c === 'grey' ? '#64748b' : c === 'cyan' ? '#06b6d4' : c }}
                                                />
                                              ))}
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <div className={`w-1.5 h-1.5 rounded-full bg-${getCategoryColor(categoryId)}-400`} />
                                            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-300">{categoryId}</span>
                                            <span className="text-[8px] text-slate-600 font-medium ml-auto">{groupTabs.length} tabs</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {groupTabs.map((tab: Tab) => (
                                      <React.Fragment key={tab.id}>
                                        <TabRow 
                                          tab={tab} 
                                          onTogglePin={handleTogglePin} 
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
                <div className="glass-card rounded-[20px] overflow-hidden divide-y divide-white/[0.03] text-left max-h-[200px] overflow-y-auto">
                  {sessions.map(session => (
                    <div key={session.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-all group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{session.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{session.tabs.length} tabs</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
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
  onTogglePin
}: { 
  tab: Tab, 
  onTogglePin: (id: string, currentlyPinned: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-white/[0.04] transition-all group relative">
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        {tab.favicon.startsWith('http') || tab.favicon.startsWith('data:') ? (
          <img src={tab.favicon} className="w-4 h-4 rounded-sm opacity-70 group-hover:opacity-100 transition-opacity" alt="" referrerPolicy="no-referrer" />
        ) : (
          <Globe size={14} className="text-slate-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-slate-300 truncate leading-tight group-hover:text-white transition-colors">{tab.title || 'Untitled'}</p>
        <p className="text-[9px] text-slate-600 truncate">{tab.url}</p>
      </div>

      <button 
        onClick={() => onTogglePin(tab.id, !!tab.pinned)}
        className={`p-2 rounded-lg transition-all border shrink-0 ${
          tab.pinned 
          ? 'text-sky-400 bg-sky-400/15 border-sky-400/30 active:bg-sky-400/25' 
          : 'text-slate-500 bg-white/[0.03] border-white/[0.05] hover:text-slate-300 hover:bg-white/10 hover:border-white/20 active:bg-white/[0.05]'
        }`}
        title={tab.pinned ? 'Unpin tab' : 'Pin tab'}
      >
        {tab.pinned ? <Pin size={12} className="fill-current" /> : <Pin size={12} />}
      </button>
    </div>
  );
}

// --- HELPERS ---

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
    'Study': [
      'github.com', 'gitlab.com', 'stackoverflow.com', 'react.dev', 'developer.mozilla.org', 
      'leetcode.com', 'hackerrank.com', 'udemy.com', 'coursera.org', 'edx.org', 
      'khanacademy.org', 'w3schools.com', 'freecodecamp.org', 'geeksforgeeks.org', 
      'wikipedia.org', 'openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com'
    ],
    'Work': [
      'docs.google.com', 'drive.google.com', 'sheets.google.com', 'slides.google.com', 'notion.so', 
      'figma.com', 'slack.com', 'trello.com', 'mail.google.com', 'outlook.live.com', 
      'office.com', 'linear.app', 'jira.', 'asana.com', 'monday.com', 'airtable.com', 
      'miro.com', 'zoom.us', 'meet.google.com'
    ],
    'Entertainment': [
      'netflix.com', 'twitch.tv', 'vimeo.com', 'spotify.com', 'primevideo.', 'hulu.com', 
      'disneyplus.com', 'soundcloud.com', 'imdb.com'
    ],
    'Social': [
      'twitter.com', 'x.com', 'reddit.com', 'facebook.com', 'instagram.com', 'tiktok.com', 
      'discord.com', 'web.whatsapp.com', 'telegram.org'
    ]
  };

  for (const [category, domains] of Object.entries(rules)) {
    if (domains.some(domain => l.includes(domain))) return category;
  }

  return 'Others';
}

function getCategoryColor(category: string): 'blue' | 'cyan' | 'green' | 'grey' | 'orange' | 'pink' | 'purple' | 'red' | 'yellow' {
  const colors: Record<string, string> = {
    'Study': 'green',
    'Work': 'blue',
    'Entertainment': 'red',
    'Social': 'pink',
    'Others': 'grey'
  };
  return (colors[category] || 'grey') as any;
}

function getCategoryOrder(): string[] {
  return ['Study', 'Work', 'Social', 'Entertainment', 'Others'];
}
