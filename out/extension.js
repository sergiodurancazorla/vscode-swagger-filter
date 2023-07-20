"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const yaml_1 = require("yaml");
const yaml = require("js-yaml");
let filterTag;
let filterParameter;
function activate(context) {
    let disposable = vscode.commands.registerCommand('swagger-filter.previewFilteredSwagger', async () => {
        const editor = vscode.window.activeTextEditor;
        let config = vscode.workspace.getConfiguration('swagger-filter');
        filterTag = config.get('filterTag', 'NOT EXPOSED');
        filterParameter = config.get('filterParameter', { name: 'x-docs-read-only', value: true });
        if (!editor) {
            vscode.window.showErrorMessage('No se encontró un archivo abierto.');
            return;
        }
        const filePath = editor.document.fileName;
        const swaggerContent = await loadSwaggerFile(filePath);
        if (!swaggerContent) {
            vscode.window.showErrorMessage('No se pudo cargar el archivo Swagger.');
            return;
        }
        try {
            const filteredSwaggerContent = filterSwagger(swaggerContent, filterTag, filterParameter);
            showSwaggerPreview(filteredSwaggerContent);
        }
        catch (error) {
            vscode.window.showErrorMessage('Ocurrió un error al filtrar el archivo Swagger.');
        }
    });
    // Create the activity bar item
    // TODO
    const activityBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    activityBarItem.text = "Swagger Filter";
    activityBarItem.command = 'swagger-filter.previewFilteredSwagger';
    activityBarItem.tooltip = "Preview Filtered Swagger";
    activityBarItem.show();
    context.subscriptions.push(disposable, activityBarItem);
}
exports.activate = activate;
async function loadSwaggerFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                try {
                    let swaggerJson = yaml.load(data);
                    let swaggerContent = JSON.stringify(swaggerJson);
                    resolve(swaggerContent);
                }
                catch (error) {
                    reject(error);
                }
            }
        });
    });
}
function filterSwagger(swaggerContent, filterTag, filterParameter) {
    let swaggerJson;
    try {
        swaggerJson = JSON.parse(swaggerContent);
    }
    catch {
        try {
            swaggerJson = (0, yaml_1.parse)(swaggerContent);
        }
        catch {
            throw new Error('El archivo Swagger no es válido.');
        }
    }
    let filteredPaths = Object.keys(swaggerJson.paths).reduce((filtered, pathKey) => {
        let pathObject = swaggerJson.paths[pathKey];
        let filteredMethods = Object.keys(pathObject).reduce((filteredMethods, methodKey) => {
            let methodObject = pathObject[methodKey];
            let tags = methodObject.tags;
            let parameters = methodObject;
            if ((!tags || tags.includes(filterTag)) ||
                (parameters[filterParameter.name] && parameters[filterParameter.name] === filterParameter.value)) {
                console.log(`Method '${methodKey}' in path '${pathKey}' is filtered out.`);
            }
            else {
                filteredMethods[methodKey] = methodObject;
            }
            return filteredMethods;
        }, {});
        if (Object.keys(filteredMethods).length > 0) {
            filtered[pathKey] = filteredMethods;
        }
        return filtered;
    }, {});
    let filteredSwaggerJson = { ...swaggerJson, paths: filteredPaths };
    if (swaggerContent.startsWith('---')) {
        return (0, yaml_1.stringify)(filteredSwaggerJson);
    }
    else {
        return JSON.stringify(filteredSwaggerJson, null, 2);
    }
}
function showSwaggerPreview(swaggerContent) {
    const panel = vscode.window.createWebviewPanel('swaggerPreview', 'Swagger Preview', vscode.ViewColumn.One, {
        enableScripts: true
    });
    const swaggerUIFolderPath = path.join(__dirname, 'swagger-ui');
    const webviewFolderPath = panel.webview.asWebviewUri(vscode.Uri.file(swaggerUIFolderPath));
    panel.webview.html = `
    <!DOCTYPE html>
    <html lang="en" class="light">
    <head>
      <meta charset="UTF-8">
      <title>Swagger UI</title>
	  <style>
        /* Hoja de estilos personalizada para anular el tema oscuro */
        body {
          background-color: #ffffff;
        }
        .scheme-container {
          background-color: #f3f3f3;
        }
        .topbar-wrapper {
          background-color: #fafafa;
        }
      </style>
      <link rel="stylesheet" type="text/css" href="${webviewFolderPath}/swagger-ui.css">
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="${webviewFolderPath}/swagger-ui-bundle.js"></script>
      <script src="${webviewFolderPath}/swagger-ui-standalone-preset.js"></script>
      <script>
        const spec = ${swaggerContent};
        const ui = SwaggerUIBundle({
          spec: spec,
          dom_id: '#swagger-ui',
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          layout: 'BaseLayout'
        });

      </script>
    </body>
    </html>
  `;
    panel.onDidDispose(() => {
        // Lógica de limpieza adicional si es necesario
    });
}
function deactivate() {
    // No se requiere ninguna limpieza especial al desactivar la extensión
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map