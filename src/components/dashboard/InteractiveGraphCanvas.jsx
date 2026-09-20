// src/components/dashboard/InteractiveGraphCanvas.jsx
import React, { useRef, useEffect, useState } from 'react';
import { Search, ZoomIn, ZoomOut, RefreshCw, X, FileCode, Layers, ArrowUpRight } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../ui/Card';
import Badge from '../ui/Badge';

export default function InteractiveGraphCanvas({ files = [], structureTree = {}, onSelectFile }) {
  const canvasRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // ── Build Clustered Nodes & Links from files ──
  useEffect(() => {
    if (!files || files.length === 0) return;

    const fileList = files.slice(0, 60);
    const width = 900;
    const height = 480;

    // Detect layers/directories
    const layerMap = {};
    for (const f of fileList) {
      const parts = f.name.split('/');
      const layer = parts.length > 1 ? parts[parts.length - 2] : 'root';
      if (!layerMap[layer]) layerMap[layer] = [];
      layerMap[layer].push(f);
    }

    const layerNames = Object.keys(layerMap);
    const clusterPositions = {};
    const clusterList = [];

    // Assign anchor centroids to each layer
    layerNames.forEach((layer, idx) => {
      const angle = (idx / layerNames.length) * 2 * Math.PI;
      const clusterRadius = 140;
      const cx = width / 2 + clusterRadius * Math.cos(angle);
      const cy = height / 2 + clusterRadius * Math.sin(angle);
      clusterPositions[layer] = { x: cx, y: cy };
      clusterList.push({ name: layer, x: cx, y: cy, count: layerMap[layer].length });
    });

    const layerColors = {
      routes: '#06b6d4',
      api: '#06b6d4',
      controllers: '#06b6d4',
      services: '#8b5cf6',
      models: '#ec4899',
      db: '#ec4899',
      components: '#10b981',
      ui: '#10b981',
      utils: '#f59e0b',
      helpers: '#f59e0b',
      root: '#94a3b8'
    };

    const generatedNodes = [];
    layerNames.forEach(layer => {
      const centroid = clusterPositions[layer];
      const layerFiles = layerMap[layer];

      layerFiles.forEach((f, idx) => {
        const offsetAngle = (idx / layerFiles.length) * 2 * Math.PI;
        const offsetR = 30 + Math.random() * 40;
        const ext = f.name.split('.').pop();
        const nodeColor = layerColors[layer.toLowerCase()] || '#8b5cf6';

        generatedNodes.push({
          id: f.name,
          name: f.name.split('/').pop(),
          path: f.name,
          ext,
          layer,
          content: f.content || '',
          x: centroid.x + offsetR * Math.cos(offsetAngle),
          y: centroid.y + offsetR * Math.sin(offsetAngle),
          color: nodeColor
        });
      });
    });

    const generatedLinks = [];
    for (let i = 0; i < generatedNodes.length; i++) {
      for (let j = i + 1; j < generatedNodes.length; j++) {
        const targetBase = generatedNodes[j].name.replace(/\.[^/.]+$/, '');
        if (generatedNodes[i].content.includes(targetBase)) {
          generatedLinks.push({ source: generatedNodes[i].id, target: generatedNodes[j].id });
        }
      }
    }

    setNodes(generatedNodes);
    setLinks(generatedLinks);
    setClusters(clusterList);
  }, [files]);

  // ── Render Canvas ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    let animId;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Draw Cluster Background Hulls
      for (const cl of clusters) {
        ctx.beginPath();
        ctx.arc(cl.x, cl.y, 65, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(30, 41, 59, 0.35)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Cluster Layer Label
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`/${cl.name}`, cl.x, cl.y - 72);
      }

      // Draw Links
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      for (const link of links) {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        if (sourceNode && targetNode) {
          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          ctx.stroke();
        }
      }

      // Draw Nodes
      for (const node of nodes) {
        const isMatch = search && node.name.toLowerCase().includes(search.toLowerCase());
        const isSelected = selectedNode?.id === node.id;

        ctx.beginPath();
        ctx.arc(node.x, node.y, isSelected ? 10 : isMatch ? 9 : 6.5, 0, 2 * Math.PI);
        ctx.fillStyle = isSelected ? '#ec4899' : isMatch ? '#f59e0b' : node.color;
        ctx.fill();

        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Node Label
        ctx.fillStyle = isSelected ? '#ffffff' : '#94a3b8';
        ctx.font = isSelected ? 'bold 10px monospace' : '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(node.name, node.x + 9, node.y + 3);
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [nodes, links, clusters, zoom, pan, search, selectedNode]);

  // ── Mouse Drag & Pan Handling ──
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    // Check node click
    const clickedNode = nodes.find(n => Math.hypot(n.x - mouseX, n.y - mouseY) < 12);
    if (clickedNode) {
      setSelectedNode(clickedNode);
      onSelectFile?.(clickedNode.id);
      return;
    }

    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-500" />
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white text-base">
                Clustered 2D Architecture Canvas
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Nodes clustered by directory layers. Click any node to focus its lineage below.
              </p>
            </div>
            <Badge color="cyan" className="ml-1">{clusters.length} Layers</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search module..."
                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <button onClick={() => setZoom(z => Math.min(2.5, z + 0.2))} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => setZoom(z => Math.max(0.4, z - 0.2))} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardBody className="!p-0 relative bg-slate-950">
        <canvas
          ref={canvasRef}
          width={900}
          height={480}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full h-[480px] cursor-grab active:cursor-grabbing"
        />

        {/* ── Slide-over File Code Drawer ── */}
        {selectedNode && (
          <div className="absolute top-0 right-0 w-80 h-full bg-slate-900/95 border-l border-slate-800 p-4 shadow-2xl overflow-y-auto z-20 space-y-3 backdrop-blur-md animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-mono text-xs text-white">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span className="font-bold truncate max-w-[170px]">{selectedNode.name}</span>
              </div>
              <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 font-mono text-[11px] text-slate-400">
              <div><strong className="text-slate-200">Path:</strong> {selectedNode.path}</div>
              <div><strong className="text-slate-200">Layer:</strong> /{selectedNode.layer}</div>
              <div><strong className="text-slate-200">Length:</strong> {selectedNode.content.length} chars</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Source Code Preview</div>
              <pre className="p-2.5 rounded bg-slate-950 text-[10px] font-mono text-slate-300 max-h-80 overflow-y-auto border border-slate-800">
                {selectedNode.content || '// Empty or binary file'}
              </pre>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
