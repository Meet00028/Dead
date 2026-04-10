import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import FileUploader from './components/FileUploader';
import CodeViewer from './components/CodeViewer';
import Dashboard from './components/Dashboard';
import SearchBar from './components/SearchBar';
import ThemeToggle from './components/ThemeToggle';
import SettingsMenu from './components/SettingsMenu';
import AISummaryPanel from './components/AISummaryPanel';
import RelationsPreview from './components/RelationsPreview';
import { parseCodebase } from './utils/codeParser';
import { generateSummary } from './utils/geminiAI';

const initialNodes = [];
const initialEdges = [];

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showDashboard, setShowDashboard] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredNodes, setFilteredNodes] = useState([]);
  const [viewMode, setViewMode] = useState('graph'); // graph, list, grid
  const [theme, setTheme] = useState('dark');
  const fileInputRef = useRef(null);
  const [showAISummary, setShowAISummary] = useState(false);
  const [showRelationsOverlay, setShowRelationsOverlay] = useState(false);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback(async (event, node) => {
    setSelectedFile(node.data);
    if (node.data.content && !node.data.summary) {
      setIsLoading(true);
      try {
        const summary = await generateSummary(node.data.content, node.data.name);
        setSelectedFile(prev => ({ ...prev, summary }));
        setNodes((nds) =>
          nds.map((n) =>
            n.id === node.id
              ? { ...n, data: { ...n.data, summary } }
              : n
          )
        );
      } catch (error) {
        console.error('Error generating summary:', error);
      }
      setIsLoading(false);
    }
  }, [setNodes]);

  // Auto-generate summary when selecting via dashboard list as well
  useEffect(() => {
    const maybeSelected = selectedFile;
    const hasContent = !!maybeSelected?.content;
    const needsSummary = hasContent && !maybeSelected?.summary && isLoading === false;
    if (needsSummary) {
      (async () => {
        setIsLoading(true);
        try {
          const summary = await generateSummary(maybeSelected.content, maybeSelected.name);
          setSelectedFile(prev => prev ? { ...prev, summary } : prev);
          setNodes((nds) => nds.map((n) => n.data?.name === maybeSelected.name ? { ...n, data: { ...n.data, summary } } : n));
        } catch (error) {
          console.error('Error generating summary:', error);
        }
        setIsLoading(false);
      })();
    }
  }, [selectedFile, isLoading, setNodes]);

  const handleFilesUpload = useCallback(async (files) => {
    setIsAnalyzing(true);
    setShowWelcome(false);
    setShowDashboard(true);
    try {
      const { nodes: newNodes, edges: newEdges } = await parseCodebase(files);
      
      const animatedNodes = newNodes.map((node, index) => ({
        ...node,
        style: {
          ...node.style,
          opacity: 0,
          transform: 'translateY(30px) scale(0.9)',
          transition: `all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.1}s`,
        },
      }));
      
      setNodes(animatedNodes);
      setEdges(newEdges);
      setFilteredNodes(newNodes);
      
      setTimeout(() => {
        setNodes(newNodes.map(node => ({
          ...node,
          style: {
            ...node.style,
            opacity: 1,
            transform: 'translateY(0) scale(1)',
          },
        })));
      }, 100);
      
    } catch (error) {
      console.error('Error parsing codebase:', error);
    }
    setIsAnalyzing(false);
  }, [setNodes, setEdges]);

  // Search functionality
  useEffect(() => {
    if (!searchQuery) {
      setFilteredNodes(nodes);
    } else {
      const filtered = nodes.filter(node => 
        node.data.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.data.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.data.content && node.data.content.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredNodes(filtered);
    }
  }, [searchQuery, nodes]);

  // Auto-hide welcome when files are uploaded
  useEffect(() => {
    if (nodes.length > 0) {
      setShowWelcome(false);
    }
  }, [nodes.length]);

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-badge">🗺️</div>
          <span>Codebase Cartographer</span>
        </div>
        <div className="flex-1 max-w-4xl mx-auto">
          <SearchBar 
            searchQuery={searchQuery} 
            setSearchQuery={setSearchQuery}
            theme={theme}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAISummary((v) => !v)}
            className="px-3 py-1.5 text-xs rounded-md bg-white/10 hover:bg-white/20 text-gray-100"
          >
            AI Summary
          </button>
          <button
            onClick={() => nodes.length > 0 && setShowRelationsOverlay(true)}
            disabled={nodes.length === 0}
            className={`px-3 py-1.5 text-xs rounded-md ${nodes.length === 0 ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-white/10 hover:bg-white/20 text-gray-100'}`}
          >
            Relations
          </button>
          <SettingsMenu 
            theme={theme} 
            setTheme={setTheme} 
            showDashboard={showDashboard} 
            setShowDashboard={setShowDashboard} 
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="app-main">
        <div className="main-content">
          {/* Welcome Section centered outside ReactFlow to avoid overlap */}
          {nodes.length === 0 && (
            <div className="h-full w-full flex items-center justify-center p-6">
              <div className="text-center space-y-8 max-w-3xl animate-fade-in-up">
                <div className="glass rounded-3xl p-12">
                  <div className="space-y-6">
                    <div className="text-8xl mb-6">🗺️</div>
                    <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                      Transform your codebase
                    </h2>
                    <p className="text-xl text-gray-300 leading-relaxed">
                      Upload your files to create an interactive visualization of your project. No overlays, no clutter — a clean, centered experience.
                    </p>
                    <div className="pt-6 flex justify-center">
                      <div className="max-w-xl w-full">
                        <FileUploader 
                          onFilesUpload={handleFilesUpload} 
                          isLoading={isAnalyzing} 
                          theme={theme}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard Sidebar */}
          {showDashboard && nodes.length > 0 && (
            <div className="absolute left-0 top-0 bottom-0 w-80 bg-black/30 backdrop-blur-xl border-r border-white/10 z-40 animate-slide-in-left">
              <Dashboard 
                nodes={nodes} 
                edges={edges} 
                selectedFile={selectedFile}
                onFileSelect={setSelectedFile}
                theme={theme}
              />
            </div>
          )}

          {/* Main Graph View */}
          {nodes.length > 0 && (
            <div className={`h-full transition-all duration-300 ${showDashboard && nodes.length > 0 ? 'ml-80' : ''} ${selectedFile ? 'mr-96' : ''}`}>
              <ReactFlow
                nodes={filteredNodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                fitView
                className="bg-transparent"
                nodeTypes={{}}
                edgeTypes={{}}
              >
                <Controls 
                  className="bg-black/30 border-white/20 backdrop-blur-xl"
                  style={{ 
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '16px',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                  }}
                />
                <MiniMap
                  nodeColor="#667eea"
                  className="bg-black/30 border-white/20 backdrop-blur-xl"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '16px',
                    backdropFilter: 'blur(20px)',
                  }}
                />
                <Background 
                  variant="dots" 
                  gap={25} 
                  size={1.5} 
                  color="rgba(102, 126, 234, 0.15)"
                  className="opacity-40"
                />

                {/* Stats Panel */}
                {!showDashboard && (
                  <Panel 
                    position="top-right" 
                    className="glass rounded-2xl p-6 animate-slide-in-right"
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(20px)',
                    }}
                  >
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white">Project Stats</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-400">{nodes.length}</div>
                          <div className="text-xs text-gray-300">Files</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-400">{edges.length}</div>
                          <div className="text-xs text-gray-300">Dependencies</div>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-white/10">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">Complexity</span>
                          <span className="text-green-400 font-medium">
                            {nodes.reduce((acc, node) => acc + (node.data.complexity || 0), 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Panel>
                )}
              </ReactFlow>
            </div>
          )}
          {/* Code Viewer Sidebar */}
          {selectedFile && (
            <div 
              className="absolute right-0 top-0 bottom-0 w-96 bg-black/30 backdrop-blur-xl border-l border-white/10 animate-slide-in-right z-30"
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <CodeViewer file={selectedFile} isLoading={isLoading} theme={theme} />
            </div>
          )}
        </div>

      </div>

      {/* AI Summary Panel */}
      <AISummaryPanel
        file={selectedFile}
        isLoading={isLoading}
        isOpen={showAISummary}
        onClose={() => setShowAISummary(false)}
      />

      {/* Relations Preview */}
      {nodes.length > 0 && !showRelationsOverlay && (
        <RelationsPreview
          nodes={nodes}
          edges={edges}
          onExpand={() => setShowRelationsOverlay(true)}
        />
      )}

      {/* Relations Overlay */}
      {showRelationsOverlay && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl">
          <div className="absolute top-3 right-3">
            <button
              onClick={() => setShowRelationsOverlay(false)}
              className="px-3 py-1.5 text-xs rounded-md bg-white/10 hover:bg-white/20 text-gray-100"
            >
              Close
            </button>
          </div>
          <div className="w-full h-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              fitView
              className="bg-transparent"
            >
              <Controls />
              <MiniMap />
              <Background variant="dots" gap={24} size={1} color="rgba(255,255,255,0.2)" />
            </ReactFlow>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
