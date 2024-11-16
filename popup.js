document.addEventListener('DOMContentLoaded', () => {
    const favoritesList = document.getElementById('favoritesList');
    const addCurrentSiteButton = document.getElementById('addCurrentSite');
    const exportFavoritesButton = document.getElementById('exportFavorites');
    const importFavoritesButton = document.getElementById('importFavoritesButton');
    const importFileInput = document.getElementById('importFile');
  
    // Chargement initial des favoris
    loadFavorites();
  
    addCurrentSiteButton.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        chrome.storage.sync.get('favorites', (data) => {
          const newFavorite = {
            url: tab.url,
            title: tab.title,
            favicon: tab.favIconUrl
          };
          const favorites = data.favorites.concat(newFavorite);
          chrome.storage.sync.set({ favorites }, () => {
            loadFavorites();  // Rechargement des favoris après ajout
          });
        });
      });
    });
  
    exportFavoritesButton.addEventListener('click', () => {
      chrome.storage.sync.get('favorites', (data) => {
        if (data.favorites.length == 0) {
          window.alert('Empty');
          return false;
        }
        
        console.log(data.favorites);
        const favorites = data.favorites;
        const htmlContent = generateFavoritesHTML(favorites);
        downloadFile(htmlContent, 'favorites.html', 'text/html');
      });
    });
  
    importFavoritesButton.addEventListener('click', () => {
      importFileInput.click();
    });
  
    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const htmlContent = event.target.result;
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlContent, 'text/html');
          const links = doc.querySelectorAll('a');
          const newFavorites = Array.from(links).map(link => ({
            url: link.href,
            title: link.textContent,
            favicon: link.getAttribute('ICON') || ''
          }));
          chrome.storage.sync.get('favorites', (data) => {
            const favorites = data.favorites.concat(newFavorites);
            chrome.storage.sync.set({ favorites }, () => {
              loadFavorites();  // Rechargement des favoris après importation
            });
          });
        };
        reader.readAsText(file);
      }
    });
  
    // Fonction pour charger et afficher les favoris
    function loadFavorites() {
      favoritesList.innerHTML = ''; // Nettoyage de la liste avant rechargement
      chrome.storage.sync.get('favorites', (data) => {
        data.favorites.forEach((favorite, index) => {
          addFavoriteToList(favorite, index);
        });
      });
    }
  
    // Fonction pour ajouter un favori à la liste visuellement
    function addFavoriteToList(favorite, index) {
      const listItem = document.createElement('li');
      listItem.setAttribute('draggable', 'true');
      listItem.dataset.index = index;
  
      const favicon = document.createElement('img');
      favicon.src = favorite.favicon;
  
      const titleLink = document.createElement('a');
      titleLink.href = favorite.url;
      titleLink.textContent = favorite.title;
      titleLink.target = "_blank"; // Ouvrir dans un nouvel onglet
  
      const editButton = document.createElement('button');
      editButton.className = 'edit';
      editButton.textContent = '\u270E';  // Utilisation du code Unicode pour ✎
      editButton.addEventListener('click', () => editTitle(index));
  
      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete';
      deleteButton.textContent = '\u274C';  // Utilisation du code Unicode pour ❌
      deleteButton.addEventListener('click', () => deleteFavorite(index));
  
      listItem.appendChild(favicon);
      listItem.appendChild(titleLink);
      listItem.appendChild(editButton);
      listItem.appendChild(deleteButton);
      favoritesList.appendChild(listItem);
    }
  
    favoritesList.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', e.target.dataset.index);
    });
  
    favoritesList.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
  
    favoritesList.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedIndex = e.dataTransfer.getData('text/plain');
      const targetIndex = e.target.closest('li').dataset.index;
  
      chrome.storage.sync.get('favorites', (data) => {
        const favorites = data.favorites;
        const draggedItem = favorites.splice(draggedIndex, 1)[0];
        favorites.splice(targetIndex, 0, draggedItem);
        chrome.storage.sync.set({ favorites }, () => {
          loadFavorites();  // Rechargement des favoris après réarrangement
        });
      });
    });
  
    function editTitle(index) {
      const newTitle = prompt('New title:');
      if (newTitle) {
        chrome.storage.sync.get('favorites', (data) => {
          const favorites = data.favorites;
          favorites[index].title = newTitle;
          chrome.storage.sync.set({ favorites }, () => {
            loadFavorites();  // Rechargement des favoris après édition
          });
        });
      }
    }
  
    function deleteFavorite(index) {
      chrome.storage.sync.get('favorites', (data) => {
        const favorites = data.favorites;
        favorites.splice(index, 1);
        chrome.storage.sync.set({ favorites }, () => {
          loadFavorites();  // Rechargement des favoris après suppression
        });
      });
    }
  
    // Fonction pour générer le fichier HTML des favoris
    function generateFavoritesHTML(favorites) {
      let html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n';
      html += '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n';
      html += '<TITLE>Bookmarks</TITLE>\n';
      html += '<H1>Bookmarks</H1>\n';
      html += '<DL><p>\n';
      favorites.forEach(favorite => {
        html += `    <DT><A HREF="${favorite.url}" ICON="${favorite.favicon}">${favorite.title}</A>\n`;
      });
      html += '</DL><p>\n';
      return html;
    }
  
    // Fonction pour déclencher le téléchargement d'un fichier
    function downloadFile(content, fileName, contentType) {
      const blob = new Blob([content], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  });
  