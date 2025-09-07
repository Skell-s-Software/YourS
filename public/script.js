const fileList = document.getElementById('file-list');
const pathDisplay = document.getElementById('path-display');
let currentPath = '';

// Función para formatear el tamaño en MB
function formatSize(bytes) {
  if (bytes === 0) return '0 MB';
  const megabytes = bytes / (1024 * 1024);
  return megabytes.toFixed(2) + ' MB';
}

// Función principal para obtener y mostrar archivos del backend
async function fetchFiles(path = '') {
  currentPath = path;
  pathDisplay.textContent = "~/" + path + "/" || '/';

  try {
    const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error);
    }
    const files = await response.json();

    fileList.innerHTML = '';

    if (path !== '') {
      const parentPath = path.split('/').slice(0, -1).join('/');
      const backItem = document.createElement('li');
      backItem.innerHTML = '📂 .. (Volver)';
      backItem.classList.add('back-btn');
      backItem.addEventListener('click', () => fetchFiles(parentPath));
      fileList.appendChild(backItem);
    }

    files.forEach(file => {
      const li = document.createElement('li');
      const filePath = path ? `${path}/${file.name}` : file.name;

      if (file.isDirectory) {
        li.innerHTML = `<span class="icon">📂</span> ${file.name}`;
        li.addEventListener('click', () => {
          fetchFiles(filePath);
        });
      } else {
        li.innerHTML = `<span class="icon">📄</span> ${file.name} | <span class="size">${formatSize(file.size)}</span>`;

        const previewButton = document.createElement('button');
        previewButton.textContent = 'Previsualizar';
        previewButton.classList.add('preview-btn');
        previewButton.addEventListener('click', (e) => {
          e.stopPropagation();
          window.open(`/api/preview?path=${encodeURIComponent(filePath)}`, '_blank');
        });
        li.appendChild(previewButton);

        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Descargar';
        downloadButton.classList.add('download-btn');
        downloadButton.addEventListener('click', (e) => {
          e.stopPropagation();
          window.location.href = `/api/download?path=${encodeURIComponent(filePath)}`;
        });
        li.appendChild(downloadButton);
      }

      const renameButton = document.createElement('button');
      renameButton.textContent = 'Renombrar';
      renameButton.classList.add('rename-btn');
      renameButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newName = prompt(`Ingresa el nuevo nombre para ${file.name}:`, file.name);
        if (newName && newName !== file.name) {
          try {
            const response = await fetch('/api/rename', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ oldPath: filePath, newName: newName }),
            });
            const result = await response.json();
            if (response.ok) {
              alert(result.message);
              fetchFiles(currentPath);
            } else {
              alert(`Error: ${result.error}`);
            }
          } catch (error) {
            alert('Hubo un error al renombrar el elemento.');
          }
        }
      });
      li.appendChild(renameButton);

      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Eliminar';
      deleteButton.classList.add('delete-btn');
      deleteButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`¿Estás seguro de que quieres eliminar ${file.name}?`)) {
          try {
            const response = await fetch(`/api/delete?path=${encodeURIComponent(filePath)}`, {
              method: 'DELETE',
            });
            const result = await response.json();
            if (response.ok) {
              alert(result.message);
              fetchFiles(currentPath);
            } else {
              alert(`Error: ${result.error}`);
            }
          } catch (error) {
            alert('Hubo un error al eliminar el elemento.');
          }
        }
      });
      li.appendChild(deleteButton);

      fileList.appendChild(li);
    });
  } catch (error) {
    alert(`Error al cargar los archivos: ${error.message}`);
  }
}

// Carga los archivos iniciales al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  fetchFiles();
});