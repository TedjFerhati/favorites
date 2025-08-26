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
            const newFavorite = {
                url: tab.url,
                title: tab.title,
                favicon: tab.favIconUrl
            };
            saveFavorite(newFavorite);
        });
    });

    exportFavoritesButton.addEventListener('click', () => {
        chrome.storage.sync.get('favorites', (data) => {
            if (!data.favorites || data.favorites.length === 0) {
                window.alert('Empty');
                return;
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
                        chrome.storage.local.set({ favorites }); // Sauvegarde locale
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
            if (chrome.runtime.lastError || !data.favorites) {
                chrome.storage.local.get('favorites', (localData) => {
                    if (!chrome.runtime.lastError && localData.favorites) {
                        displayFavorites(localData.favorites);
                    } else {
                        console.error('Erreur de chargement des favoris:', chrome.runtime.lastError);
                    }
                });
            } else {
                displayFavorites(data.favorites);
            }
        });
    }

    // Fonction pour afficher les favoris
    function displayFavorites(favorites) {
        favorites.forEach((favorite, index) => {
            addFavoriteToList(favorite, index);
        });
        setupDragAndDrop();
    }

    // Fonction pour ajouter un favori à la liste visuellement
    function addFavoriteToList(favorite, index) {
        const listItem = document.createElement('li');
        listItem.setAttribute('draggable', 'true');
        listItem.dataset.index = index;

        const favicon = document.createElement('img');
        favicon.src = favorite.favicon || 'default-favicon.png'; // Ajouter une image par défaut

        const titleLink = document.createElement('a');
        titleLink.href = favorite.url;
        titleLink.textContent = favorite.title;
        titleLink.target = "_blank"; // Ouvrir dans un nouvel onglet

        const editButton = document.createElement('button');
        editButton.className = 'edit';
        editButton.textContent = '\u270E';  // Utilisation du code Unicode pour ✎
        editButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            editTitle(index);
        });

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete';
        deleteButton.textContent = '\u274C';  // Utilisation du code Unicode pour ❌
        deleteButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteFavorite(index);
        });

        listItem.appendChild(favicon);
        listItem.appendChild(titleLink);
        listItem.appendChild(editButton);
        listItem.appendChild(deleteButton);
        favoritesList.appendChild(listItem);
    }

    // Modifications à ajouter à votre fonction setupDragAndDrop() dans popup.js

    function setupDragAndDrop() {
        const items = favoritesList.querySelectorAll('li');
        let draggedItem = null;
        let dropIndicator = document.createElement('div');
        dropIndicator.className = 'drop-indicator';

        items.forEach(item => {
            // Gestionnaire d'événement dragstart
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                setTimeout(() => {
                    item.classList.add('dragging');
                }, 0);
                e.dataTransfer.setData('text/plain', item.dataset.index);
                e.dataTransfer.effectAllowed = 'move';
            });

            // Gestionnaire d'événement dragend
            item.addEventListener('dragend', () => {
                draggedItem.classList.remove('dragging');
                draggedItem = null;
                items.forEach(item => item.classList.remove('drag-over'));
                // Retirer l'indicateur
                if (dropIndicator.parentNode) {
                    dropIndicator.parentNode.removeChild(dropIndicator);
                }
            });

            // Gestionnaire d'événement dragover
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (item !== draggedItem) {
                    // Déterminer si on est dans la moitié supérieure ou inférieure de l'élément
                    const rect = item.getBoundingClientRect();
                    const midPoint = rect.top + rect.height / 2;
                    const isUpperHalf = e.clientY < midPoint;

                    // Supprimer l'indicateur existant s'il existe
                    if (dropIndicator.parentNode) {
                        dropIndicator.parentNode.removeChild(dropIndicator);
                    }

                    // Ajouter l'indicateur à la bonne position
                    dropIndicator.className = `drop-indicator ${isUpperHalf ? 'top' : 'bottom'}`;
                    item.appendChild(dropIndicator);

                    items.forEach(i => i.classList.remove('drag-over'));
                }
                return false;
            });

            // Gestionnaire d'événement dragleave
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            // Gestionnaire d'événement drop
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (item !== draggedItem) {
                    const sourceIndex = parseInt(draggedItem.dataset.index);
                    const targetIndex = parseInt(item.dataset.index);

                    // Déterminer si on place avant ou après en fonction de la position du curseur
                    const rect = item.getBoundingClientRect();
                    const midPoint = rect.top + rect.height / 2;
                    const placeAfter = e.clientY > midPoint;

                    moveFavorite(sourceIndex, targetIndex, placeAfter);
                    item.classList.remove('drag-over');

                    // Retirer l'indicateur
                    if (dropIndicator.parentNode) {
                        dropIndicator.parentNode.removeChild(dropIndicator);
                    }
                }
                return false;
            });
        });

        // Gestion du drop à la fin de la liste
        favoritesList.addEventListener('dragover', (e) => {
            const items = favoritesList.querySelectorAll('li');
            const lastItem = items[items.length - 1];

            if (lastItem && draggedItem) {
                const rect = lastItem.getBoundingClientRect();
                const isAfterLastItem = e.clientY > rect.bottom;

                if (isAfterLastItem) {
                    e.preventDefault();
                    // Supprimer l'indicateur existant s'il existe
                    if (dropIndicator.parentNode) {
                        dropIndicator.parentNode.removeChild(dropIndicator);
                    }

                    // Ajouter l'indicateur après le dernier élément
                    dropIndicator.className = 'drop-indicator bottom';
                    lastItem.appendChild(dropIndicator);
                }
            }
        });

        favoritesList.addEventListener('drop', (e) => {
            const items = favoritesList.querySelectorAll('li');
            if (items.length > 0) {
                const lastItem = items[items.length - 1];
                const rect = lastItem.getBoundingClientRect();
                const isAfterLastItem = e.clientY > rect.bottom;

                if (isAfterLastItem && draggedItem) {
                    e.preventDefault();
                    const sourceIndex = parseInt(draggedItem.dataset.index);
                    moveFavorite(sourceIndex, items.length - 1, true);

                    // Retirer l'indicateur
                    if (dropIndicator.parentNode) {
                        dropIndicator.parentNode.removeChild(dropIndicator);
                    }
                }
            }
        });
    }
    // Fonction pour déplacer un favori
    function moveFavorite(fromIndex, toIndex, placeAfter = false) {
        chrome.storage.sync.get('favorites', (data) => {
            const favorites = data.favorites;

            // Ajuster l'index si on place après
            if (placeAfter) {
                toIndex++;
            }

            // Récupérer l'élément à déplacer
            const [movedItem] = favorites.splice(fromIndex, 1);

            // Ajuster l'index de destination si nécessaire
            if (fromIndex < toIndex) {
                toIndex--;
            }

            // Insérer l'élément à sa nouvelle position
            favorites.splice(toIndex, 0, movedItem);

            // Sauvegarder les favoris réorganisés
            chrome.storage.sync.set({ favorites }, () => {
                chrome.storage.local.set({ favorites }); // Sauvegarde locale
                loadFavorites();  // Rechargement des favoris après réarrangement
            });
        });
    }

    function editTitle(index) {
        const newTitle = prompt('New title:');
        if (newTitle) {
            chrome.storage.sync.get('favorites', (data) => {
                const favorites = data.favorites;
                favorites[index].title = newTitle;
                chrome.storage.sync.set({ favorites }, () => {
                    chrome.storage.local.set({ favorites }); // Sauvegarde locale
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
                chrome.storage.local.set({ favorites }); // Sauvegarde locale
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

    function saveFavorite(favorite) {
        chrome.storage.sync.get('favorites', (data) => {
            const favorites = (data.favorites || []).concat(favorite);
            chrome.storage.sync.set({ favorites }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Erreur de stockage dans sync:', chrome.runtime.lastError);
                } else {
                    chrome.storage.local.set({ favorites }); // Sauvegarde locale
                    loadFavorites();
                }
            });
        });
    }
});