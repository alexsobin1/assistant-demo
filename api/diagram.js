// Deploy this to Vercel - Fixed version with proper Mermaid syntax
// Save as api/diagram.js

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
    // Helper function to create safe IDs for Mermaid
    function createSafeId(name, index) {
      // If already has an ID, use it
      if (name.id) return name.id;
      
      // Otherwise create one from the name
      const baseName = name.name || name;
      // Replace spaces and special chars with underscores
      return baseName.toString()
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/^(\d)/, 'n$1') // Prefix with 'n' if starts with number
        || `node${index}`;
    }

    // Create a mapping of original names to safe IDs
    const idMap = {};
    components.forEach((c, i) => {
      const originalName = c.name || c;
      const safeId = createSafeId(c, i);
      idMap[originalName] = safeId;
      if (c.id) {
        idMap[c.id] = safeId;
      }
    });

    let mermaidCode = '';
    
    // Generate Mermaid diagram based on type
    switch(diagram_type) {
      case 'architecture':
      case 'system':
        mermaidCode = `graph TB\n`;
        if (title) {
          mermaidCode += `    subgraph "${title}"\n`;
        }
        
        // Add components with safe IDs
        components.forEach((c, i) => {
          const safeId = idMap[c.name || c];
          const label = c.name || c;
          const type = c.type || 'service';
          
          if (type === 'database') {
            mermaidCode += `        ${safeId}[("${label}")]\n`;
          } else if (type === 'queue') {
            mermaidCode += `        ${safeId}{{"${label}"}}\n`;
          } else if (type === 'user') {
            mermaidCode += `        ${safeId}((("${label}")))\n`;
          } else if (type === 'api') {
            mermaidCode += `        ${safeId}[/"${label}"\\]\n`;
          } else {
            mermaidCode += `        ${safeId}["${label}"]\n`;
          }
        });
        
        if (title) {
          mermaidCode += `    end\n`;
        }
        
        // Add relationships using safe IDs
        relationships?.forEach(r => {
          const fromId = idMap[r.from] || r.from.replace(/[^a-zA-Z0-9]/g, '_');
          const toId = idMap[r.to] || r.to.replace(/[^a-zA-Z0-9]/g, '_');
          const arrow = r.type === 'async' ? '-.->' : '-->';
          
          if (r.label) {
            mermaidCode += `    ${fromId} ${arrow}|"${r.label}"| ${toId}\n`;
          } else {
            mermaidCode += `    ${fromId} ${arrow} ${toId}\n`;
          }
        });
        break;

      case 'sequence':
        mermaidCode = `sequenceDiagram\n`;
        mermaidCode += `    autonumber\n`;
        
        // Add participants with safe aliases
        components.forEach((c, i) => {
          const safeId = idMap[c.name || c];
          const label = c.name || c;
          mermaidCode += `    participant ${safeId} as ${label}\n`;
        });
        
        // Add interactions
        relationships?.forEach(r => {
          const fromId = idMap[r.from] || r.from.replace(/[^a-zA-Z0-9]/g, '_');
          const toId = idMap[r.to] || r.to.replace(/[^a-zA-Z0-9]/g, '_');
          const arrow = r.async ? '->>' : '->';
          const label = r.label || r.action || '';
          
          mermaidCode += `    ${fromId}${arrow}${toId}: ${label}\n`;
          
          if (r.response) {
            mermaidCode += `    ${toId}-->>-${fromId}: ${r.response}\n`;
          }
        });
        break;

      case 'class':
        mermaidCode = `classDiagram\n`;
        
        components.forEach(c => {
          const safeId = idMap[c.name || c];
          const className = c.name || c;
          
          mermaidCode += `    class ${safeId} {\n`;
          mermaidCode += `        <<${className}>>\n`;
          
          if (c.properties) {
            c.properties.forEach(p => {
              const visibility = p.visibility || '+';
              mermaidCode += `        ${visibility}${p.name}: ${p.type}\n`;
            });
          }
          
          if (c.methods) {
            c.methods.forEach(m => {
              const visibility = m.visibility || '+';
              const params = m.params || '';
              const returnType = m.return || 'void';
              mermaidCode += `        ${visibility}${m.name}(${params}) ${returnType}\n`;
            });
          }
          
          mermaidCode += `    }\n`;
        });
        
        relationships?.forEach(r => {
          const fromId = idMap[r.from] || r.from.replace(/[^a-zA-Z0-9]/g, '_');
          const toId = idMap[r.to] || r.to.replace(/[^a-zA-Z0-9]/g, '_');
          
          const relType = {
            'inherits': '--|>',
            'implements': '..|>',
            'aggregation': '--o',
            'composition': '--*',
            'association': '--'
          }[r.type] || '--';
          
          if (r.label) {
            mermaidCode += `    ${fromId} ${relType} ${toId} : ${r.label}\n`;
          } else {
            mermaidCode += `    ${fromId} ${relType} ${toId}\n`;
          }
        });
        break;

      case 'deployment':
        mermaidCode = `graph LR\n`;
        mermaidCode += `    subgraph Production["Production Environment"]\n`;
        
        components.forEach((c, i) => {
          const safeId = idMap[c.name || c];
          const label = c.name || c;
          
          if (c.type === 'container') {
            mermaidCode += `        ${safeId}[["${label}"]]\n`;
          } else if (c.type === 'cloud') {
            mermaidCode += `        ${safeId}((("${label}")))\n`;
          } else {
            mermaidCode += `        ${safeId}["${label}"]\n`;
          }
        });
        
        mermaidCode += `    end\n`;
        
        relationships?.forEach(r => {
          const fromId = idMap[r.from] || r.from.replace(/[^a-zA-Z0-9]/g, '_');
          const toId = idMap[r.to] || r.to.replace(/[^a-zA-Z0-9]/g, '_');
          
          if (r.label) {
            mermaidCode += `    ${fromId} -->|"${r.label}"| ${toId}\n`;
          } else {
            mermaidCode += `    ${fromId} --> ${toId}\n`;
          }
        });
        break;

      case 'dataflow':
      case 'data_flow':
        mermaidCode = `flowchart LR\n`;
        
        components.forEach((c, i) => {
          const safeId = idMap[c.name || c];
          const label = c.name || c;
          mermaidCode += `    ${safeId}["${label}"]\n`;
        });
        
        relationships?.forEach(r => {
          const fromId = idMap[r.from] || r.from.replace(/[^a-zA-Z0-9]/g, '_');
          const toId = idMap[r.to] || r.to.replace(/[^a-zA-Z0-9]/g, '_');
          
          if (r.label) {
            mermaidCode += `    ${fromId} -->|"${r.label}"| ${toId}\n`;
          } else {
            mermaidCode += `    ${fromId} --> ${toId}\n`;
          }
        });
        break;

      default:
        // Default to simple flowchart
        mermaidCode = `graph TD\n`;
        
        if (components.length === 0) {
          mermaidCode += `    Start[Start]\n`;
          mermaidCode += `    End[End]\n`;
          mermaidCode += `    Start --> End\n`;
        } else {
          components.forEach((c, i) => {
            const safeId = idMap[c.name || c];
            const label = c.name || c;
            mermaidCode += `    ${safeId}["${label}"]\n`;
            
            if (i > 0) {
              const prevId = idMap[components[i-1].name || components[i-1]];
              mermaidCode += `    ${prevId} --> ${safeId}\n`;
            }
          });
        }
    }

    // Add notes if provided
    if (notes) {
      mermaidCode += `    %% ${notes}\n`;
    }

    // Create Mermaid Live Editor URL
    const state = {
      code: mermaidCode,
      mermaid: { 
        theme: 'default'
      },
      updateEditor: false,
      autoSync: true,
      updateDiagram: true
    };
    
    const json = JSON.stringify(state);
    const encoded = Buffer.from(json).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    const mermaidLiveUrl = `https://mermaid.live/edit#base64:${encoded}`;

    // Create a simple, speakable diagram ID
    const diagramId = `diagram-${Date.now().toString().slice(-6)}`;
    
    // Option 1: Use a URL shortener (TinyURL is free and no API key needed)
    let shortUrl = mermaidLiveUrl;
    try {
      const tinyUrlResponse = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(mermaidLiveUrl)}`);
      if (tinyUrlResponse.ok) {
        shortUrl = await tinyUrlResponse.text();
      }
    } catch (e) {
      console.log('URL shortening failed, using long URL');
    }

    // Return response that your assistant can speak
    return res.status(200).json({
      success: true,
      message: `I've created a ${diagram_type} diagram for "${title}". The diagram ID is ${diagramId}. You can access it at ${shortUrl}`,
      diagram_url: mermaidLiveUrl,
      short_url: shortUrl,
      diagram_id: diagramId,
      mermaid_code: mermaidCode,
      components_count: components.length,
      relationships_count: relationships.length,
      spoken_instructions: `To view the diagram, go to ${shortUrl.replace('https://', '').replace('http://', '')}`
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
