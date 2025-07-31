async function loadComponentInto(elementId, url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load component: ${url}`);
    }
    const html = await response.text();
    const placeholder = document.getElementById(elementId);
    if (placeholder) {
        placeholder.innerHTML = html;
    }
}

export async function loadComponents() {
    try {
        await Promise.all([
            loadComponentInto('popups-placeholder', '/templates/popups.html'),
            loadComponentInto('footer-placeholder', '/templates/footer.html')
        ]);
    } catch (error) {
        console.error("Error loading components:", error);
    }
}