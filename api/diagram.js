// Deploy this to Vercel in 2 minutes
// 1. Save as api/diagram.js in a new folder
// 2. Run: npx vercel
// 3. Get your URL like: https://your-app.vercel.app/api/diagram

export default async function handler(req, res) {
  // Enable CORS for Telnyx
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    diagram_type, 
    title, 
    components = [], 
    relationships = [],
    notes 
  } = req.body;

  try {
    let mermaidCode = '';
    
    // Generate Mermaid diagram based on type
    switch(diagram_type) {
      case 'architecture':
      case 'system':
        mermaidCode = `graph TB
    subgraph "${title}"
${components.map((c, i) => {
  const id = c.id || `C${i}`;
  const name = c.name || c;
  const type = c.type || 'service';
  
  if (type === 'database') return `        ${id}[(${name})]`;
  if (type === 'queue') return `        ${id}{{${name}}}`;
  if (type === 'user') return `        ${id}(((${name})))`;
  if (type === 'api') return `        ${id}[/"${name}"\\]`;
  return `        ${id}[${name}]`;
}).join('\n')}
    end
${relationships.map(r => {
  const arrow = r.type === 'async' ? '-.->' : '-->';
  const label = r.label ? `|${r.label}|` : '';
  return `    ${r.from} ${arrow}${label} ${r.to}`;
}).join('\n')}`;
        break;

      case 'sequence':
        mermaidCode = `sequenceDiagram
    autonumber
${components.map(c => `    participant ${c.name || c}`).join('\n')}
${relationships.map(r => {
  const arrow = r.async ? '->>' : '->';
  return `    ${r.from}${arrow}${r.to}: ${r.label || r.action || ''}`;
}).join('\n')}`;
        break;

      case 'class':
        mermaidCode = `classDiagram
${components.map(c => {
  let classDef = `    class ${c.name} {\n`;
  if (c.properties) {
    c.properties.forEach(p => {
      classDef += `        ${p.visibility || '+'}${p.name}: ${p.type}\n`;
    });
  }
  if (c.methods) {
    c.methods.forEach(m => {
      classDef += `        ${m.visibility || '+'}${m.name}(${m.params || ''}) ${m.return || 'void'}\n`;
    });
  }
  classDef += '    }';
  return classDef;
}).join('\n')}
${relationships.map(r => {
  const relType = {
    'inherits': '--|>',
    'implements': '..|>',
    'aggregation': '--o',
    'composition': '--*',
    'association': '--'
  }[r.type] || '--';
  return `    ${r.from} ${relType} ${r.to}${r.label ? ' : ' + r.label : ''}`;
}).join('\n')}`;
        break;

      case 'deployment':
        mermaidCode = `graph LR
    subgraph "Production Environment"
${components.map((c, i) => {
  const id = c.id || `C${i}`;
  const name = c.name || c;
  if (c.type === 'container') return `        ${id}[[${name}]]`;
  if (c.type === 'cloud') return `        ${id}(((${name})))`;
  return `        ${id}[${name}]`;
}).join('\n')}
    end
${relationships.map(r => `    ${r.from} --> ${r.to}`).join('\n')}`;
        break;

      case 'dataflow':
      case 'data_flow':
        mermaidCode = `flowchart LR
${components.map((c, i) => {
  const id = c.id || `C${i}`;
  const name = c.name || c;
  return `    ${id}[${name}]`;
}).join('\n')}
${relationships.map(r => {
  const label = r.label ? `|${r.label}|` : '';
  return `    ${r.from} -->${label} ${r.to}`;
}).join('\n')}`;
        break;

      default:
        // Default to simple flowchart
        mermaidCode = `graph TD
    ${title ? `A[${title}]` : 'A[Start]'}
${components.map((c, i) => `    ${String.fromCharCode(66 + i)}[${c.name || c}]`).join('\n')}
${components.map((c, i) => `    ${String.fromCharCode(65 + i)} --> ${String.fromCharCode(66 + i)}`).join('\n')}`;
    }

    // Add notes if provided
    if (notes) {
      mermaidCode += `\n    Note: ${notes}`;
    }

    // Create Mermaid Live Editor URL
    const state = {
      code: mermaidCode,
      mermaid: { theme: 'default' },
      updateEditor: false,
      autoSync: true,
      updateDiagram: true
    };
    
    const json = JSON.stringify(state);
    const encoded = Buffer.from(json).toString('base64');
    const mermaidLiveUrl = `https://mermaid.live/edit#${encoded}`;

    // Return response that your assistant can speak
    return res.status(200).json({
      success: true,
      message: `I've created a ${diagram_type} diagram for "${title}". You can view and edit it at the Mermaid Live Editor.`,
      diagram_url: mermaidLiveUrl,
      mermaid_code: mermaidCode,
      components_count: components.length,
      relationships_count: relationships.length
    });

  } catch (error) {
    console.error('Diagram generation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate diagram',
      details: error.message
    });
  }
}