(function() {
  const config = window.DOXE_AI_CONFIG;
  if (!config || !config.workspaceId) {
    console.error('DoxeAI: Missing configuration (workspaceId)');
    return;
  }

  const scriptUrl = document.currentScript.src;
  const baseUrl = scriptUrl.substring(0, scriptUrl.lastIndexOf('/'));

  // Create Container
  const container = document.createElement('div');
  container.id = 'doxe-ai-widget-container';
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.zIndex = '999999';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'flex-end';
  document.body.appendChild(container);

  // Create Iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'doxe-ai-iframe';
  iframe.src = `${baseUrl}/?widget=true&workspaceId=${config.workspaceId}`;
  iframe.style.width = '360px';
  iframe.style.height = '500px';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '16px';
  iframe.style.boxShadow = '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)';
  iframe.style.display = 'none';
  iframe.style.marginBottom = '15px';
  container.appendChild(iframe);

  // Create Toggle Button
  const button = document.createElement('button');
  button.style.width = '56px';
  button.style.height = '56px';
  button.style.borderRadius = '50%';
  button.style.backgroundColor = config.primaryColor || '#2563eb';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.cursor = 'pointer';
  button.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1)';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.transition = 'transform 0.2s';
  
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
  const closeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  
  button.innerHTML = icon;
  container.appendChild(button);

  let isOpen = false;
  button.onclick = () => {
    isOpen = !isOpen;
    iframe.style.display = isOpen ? 'block' : 'none';
    button.innerHTML = isOpen ? closeIcon : icon;
  };

  // Listen for messages from iframe
  window.addEventListener('message', (event) => {
    if (event.data.type === 'DOXE_AI_STATE') {
      if (event.data.isOpen === false && isOpen) {
        button.click();
      }
    }
  });
})();
