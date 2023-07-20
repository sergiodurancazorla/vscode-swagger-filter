import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parse, stringify } from 'yaml';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('swagger-filter.previewFilteredSwagger', async () => {
		const editor = vscode.window.activeTextEditor;
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
			const filteredSwaggerContent = filterSwagger(swaggerContent);
			showSwaggerPreview(filteredSwaggerContent);
		} catch (error) {
			vscode.window.showErrorMessage('Ocurrió un error al filtrar el archivo Swagger.');
		}
	});

	context.subscriptions.push(disposable);
}

async function loadSwaggerFile(filePath: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		fs.readFile(filePath, 'utf8', (err, data) => {
			if (err) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});
}

function filterSwagger(swaggerContent: string): string {
	let swaggerJson: any;

	try {
		swaggerJson = JSON.parse(swaggerContent);
	} catch {
		try {
			swaggerJson = parse(swaggerContent);
		} catch {
			throw new Error('El archivo Swagger no es válido.');
		}
	}

	const filteredPaths = Object.keys(swaggerJson.paths).reduce((filtered, pathKey) => {
		const pathObject = swaggerJson.paths[pathKey];
		const filteredMethods = Object.keys(pathObject).reduce((filteredMethods, methodKey) => {
			const methodObject = pathObject[methodKey];
			const tags = methodObject.tags;
			if (!tags || !tags.includes('NOT EXPOSED')) {
				filteredMethods[methodKey] = methodObject;
			}
			return filteredMethods;
		}, {} as any);

		if (Object.keys(filteredMethods).length > 0) {
			filtered[pathKey] = filteredMethods;
		}
		return filtered;
	}, {} as any);

	const filteredSwaggerJson = { ...swaggerJson, paths: filteredPaths };

	if (swaggerContent.startsWith('---')) {
		return stringify(filteredSwaggerJson);
	} else {
		return JSON.stringify(filteredSwaggerJson, null, 2);
	}
}

function showSwaggerPreview(swaggerContent: string) {
	const panel = vscode.window.createWebviewPanel(
		'swaggerPreview',
		'Swagger Preview',
		vscode.ViewColumn.One,
		{
			enableScripts: true
		}
	);

	const openApiExtension = vscode.extensions.getExtension('42Crunch.vscode-openapi');
	if (!openApiExtension) {
		vscode.window.showErrorMessage('La extensión vscode-openapi no está instalada.');
		return;
	}

	const webViewPath = panel.webview.asWebviewUri(
		vscode.Uri.file(path.join(openApiExtension.extensionPath, 'dist', 'editor', 'index.html'))
	);

	panel.webview.html = `
    <iframe src="${webViewPath}" style="width: 100%; height: 100%; border: none;"></iframe>
    <script>
      const vscode = acquireVsCodeApi();
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'ready') {
          vscode.postMessage({ type: 'load', data: ${JSON.stringify(swaggerContent)} });
        }
      });
    </script>
  `;

	panel.onDidDispose(() => {
		// Lógica de limpieza adicional si es necesario
	});
}

export function deactivate() {
	// No se requiere ninguna limpieza especial al desactivar la extensión
}
