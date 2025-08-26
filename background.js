chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('favorites', (data) => {
    if (!data.favorites) { // Si la liste de favoris n'existe pas
      chrome.storage.sync.set({ favorites: [] });
    }
  });
});

chrome.action.onClicked.addListener((tab) => {
  addCurrentSiteToFavorites(tab);
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "add-favorite") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      addCurrentSiteToFavorites(tabs[0]);
    });
  }
});

function addCurrentSiteToFavorites(tab) {
  chrome.storage.sync.get('favorites', (data) => {
    const newFavorite = {
      url: tab.url,
      title: tab.title,
      favicon: tab.favIconUrl
    };
    const favorites = data.favorites.concat(newFavorite);
    chrome.storage.sync.set({ favorites });
    chrome.storage.local.set({ favorites }); // Sauvegarde locale
  });
}
