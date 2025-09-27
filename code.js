// ====================================================================
// *** CONFIGURACIÓN - ¡MODIFICAR ESTOS VALORES! ***
// ====================================================================
const SPREADSHEET_ID = '1tEkGJ8coQZrxP1iH_GZYn76Egg6e_rFKG7G35RGohLk'; // Ej: '1tEkGJ8coQZrxP1iH_GZYn76Egg6e_rFKG7G35RGohLk'
const FOLDER_ID = '1T2zrpciJTg75gR6HzlqklMUp4-Q-Axzv9fL';   // Ej: '1T2ciJTg75gR6HzlqklMUp4-Q-Axzv9fL'
const EMAIL_TO = 'regionsureventos@il.com';     // Correo principal de notificación
const EMAIL_CC = 'trabajofrelancer@il.com';    // Correo con copia

// Nombre de la hoja de cálculo donde se guardarán los datos
const SHEET_NAME = 'Registros'; 
// ====================================================================

// Función principal para servir la página HTML (para acceder al formulario)
function doGet(e) {
    // Si se accede directamente a la URL del script
    if (e && e.parameter.source === 'web') {
        return HtmlService.createHtmlOutputFromFile('index')
            .setTitle('Registro de Clases Infantiles')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    // Si no es una solicitud web directa, devuelve una respuesta simple
    return HtmlService.createHtmlOutput('<h1>Acceso al Formulario Web</h1><p>Por favor, usa la URL del despliegue web.</p>');
}

/**
 * Función que recibe los datos enviados por un formulario externo (POST).
 * Esto es útil si decides enviar el formulario mediante fetch a la URL de tu App Script.
 * @param {Object} e Objeto de evento con los parámetros de la solicitud POST.
 * @returns {GoogleAppsScript.Content.TextOutput} Respuesta de éxito o fracaso.
 */
function doPost(e) {
    if (!e.postData || !e.postData.contents) {
        return ContentService.createTextOutput('ERROR: No se recibieron datos.')
            .setMimeType(ContentService.MimeType.TEXT);
    }

    try {
        // Asumiendo que los datos POST vienen como JSON (como lo prepara el JS del formulario)
        const formData = JSON.parse(e.postData.contents);
        Logger.log('Datos recibidos vía POST: ' + JSON.stringify(formData));
        
        // Llama a la función principal de procesamiento (la misma que usa google.script.run)
        const result = processForm(formData);
        
        if (result === 'true') {
            return ContentService.createTextOutput('SUCCESS')
                .setMimeType(ContentService.MimeType.TEXT);
        } else {
            return ContentService.createTextOutput('ERROR: Fallo al guardar los datos.')
                .setMimeType(ContentService.MimeType.TEXT);
        }
    } catch (error) {
        Logger.log('Error en doPost: ' + error.toString());
        return ContentService.createTextOutput('ERROR: ' + error.message)
            .setMimeType(ContentService.MimeType.TEXT);
    }
}


// ====================================================================
// 2. FUNCIÓN DE PRUEBA (Para validar la estructura de datos)
// ====================================================================

/**
 * Función de prueba para simular la recepción y guardado de datos.
 * Útil para probar la función submitToSpreadsheet y sendFormEmail sin enviar el formulario.
 * Ejecuta esta función manualmente en el editor de Apps Script.
 */
function testSubmission() {
    Logger.log('--- INICIANDO PRUEBA DE ENVÍO DE DATOS ---');
    
    const dummyData = {
        evento: "Clases de Prueba",
        lugar: "Garrucha, Almería",
        fecha_horario: "Sábados 10:00 - 12:00",
        email_contacto: "contacto@test.com",
        nombre_tutor: "Juan Pérez Test",
        email_tutor: "juan.test@ejemplo.es",
        telf_movil: "600112233",
        dni_tutor: "12345678A",
        nombre_menor: "Sofía Pérez Test",
        fecha_nacimiento: "2015-05-20",
        consentimiento_fotos: "Sí",
        fecha_firma: "2025-09-27",
        // Aquí puedes poner una URL de Drive de una imagen de prueba si quieres que aparezca en la hoja
        signatureUrl: "https://ejemplo.com/url-de-firma-prueba.png"
    };

    try {
        // 1. Guardar en la hoja (simula el paso 2 de processForm)
        const row = submitToSpreadsheet(dummyData);
        Logger.log(`✅ Datos de prueba guardados en la fila: ${row}`);

        // 2. Enviar correo (simula el paso 3 de processForm)
        sendFormEmail(dummyData);
        Logger.log('✅ Correo de prueba enviado.');

        Logger.log('--- PRUEBA DE ENVÍO FINALIZADA CON ÉXITO ---');
    } catch (error) {
        Logger.log('❌ PRUEBA DE ENVÍO FALLIDA: ' + error.toString());
    }
}


// ====================================================================
// 3. FUNCIONES DE PROCESAMIENTO PRINCIPALES
// ====================================================================

// Función que recibe los datos del formulario (Llamada desde index.html via google.script.run)
function processForm(formData) {
    try {
        Logger.log('Iniciando processForm con datos: ' + JSON.stringify(formData));
        let signatureUrl = '';
        // Convierte el consentimiento a texto
        formData.consentimiento_fotos = formData.consentimiento_fotos ? 'Sí' : 'No';
        
        // 1. Manejar la Firma Digital (uploadFile)
        if (formData.signature_data) {
            // Eliminar los metadatos de la URL Base64 para obtener solo los datos binarios
            const base64Data = formData.signature_data; 
            const fileName = `Firma_${formData.nombre_tutor.replace(/\s/g, '_')}_${new Date().getTime()}.png`;
            signatureUrl = uploadFile(base64Data, fileName);
            Logger.log('URL de Firma generada: ' + signatureUrl);
            formData.signatureUrl = signatureUrl; // Agregar la URL a los datos
            delete formData.signature_data;       // Eliminar la data base64 antes de guardar en la hoja
        }

        // 2. Guardar los datos en la Hoja de Cálculo
        const resultSheet = submitToSpreadsheet(formData);

        // 3. Enviar Correo Electrónico de Notificación
        sendFormEmail(formData);
        
        return 'true';
    } catch (error) {
        Logger.log('Error en processForm: ' + error.toString() + ' Stack: ' + error.stack);
        return 'false';
    }
}

// Función para subir el Base64 de la firma a Google Drive
function uploadFile(base64Data, fileName) {
    try {
        // Elimina el prefijo si existe
        if (base64Data.indexOf(',') > -1) {
            base64Data = base64Data.split(',')[1];
        }
        const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/png', fileName);
        const folder = DriveApp.getFolderById(FOLDER_ID);
        const file = folder.createFile(blob);
        return file.getUrl();
    } catch (error) {
        Logger.log('Error al subir archivo a Drive: ' + error.toString());
        throw new Error('Falló la carga de la firma: ' + error.message); 
    }
}

// Función para guardar los datos del formulario en la Hoja de Cálculo
function submitToSpreadsheet(data) {
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
        
        const headers = [
            'Timestamp', 'Evento', 'Lugar', 'Fecha/Horario', 'Email Contacto',
            'Tutor: Nombre Completo', 'Tutor: Email', 'Tutor: Telf. Móvil', 'Tutor: DNI/NIE',
            'Menor: Nombre Completo', 'Menor: Fecha Nac.', 'Consentimiento Fotos/Videos',
            'Firma: Fecha', 'Firma: URL'
        ];
        
        if (sheet.getLastRow() === 0) {
            sheet.appendRow(headers);
        }

        const rowData = [
            new Date(), 
            data.evento,
            data.lugar,
            data.fecha_horario,
            data.email_contacto,
            data.nombre_tutor,
            data.email_tutor,
            data.telf_movil,
            data.dni_tutor,
            data.nombre_menor,
            data.fecha_nacimiento,
            data.consentimiento_fotos,
            data.fecha_firma,
            // Usar la URL de Drive con la fórmula IMAGE para que se muestre en la celda
            data.signatureUrl ? `=IMAGE("${data.signatureUrl}", 4, 200, 100)` : 'Sin Firma' 
        ];
        
        sheet.appendRow(rowData);
        
        return sheet.getLastRow();
    } catch (error) {
        Logger.log('Error al guardar datos en la Hoja: ' + error.toString());
        throw new Error('Falló el guardado en la Hoja de Cálculo: ' + error.message);
    }
}

// Función para enviar la notificación por correo
function sendFormEmail(formData) {
    try {
        const subject = `✅ Nuevo Registro de Clase: ${formData.nombre_menor} (${formData.nombre_tutor})`;
        
        let htmlBody = `
            <p>Se ha recibido un nuevo registro para las Clases de Niños. Estos son los detalles:</p>
            <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                <tr style="background-color: #008080; color: white;">
                    <td colspan="2" style="font-weight: bold;">DATOS DEL EVENTO</td>
                </tr>
                <tr><td>Evento/Clases:</td><td>${formData.evento}</td></tr>
                <tr><td>Lugar:</td><td>${formData.lugar}</td></tr>
                <tr><td>Fecha/Horario:</td><td>${formData.fecha_horario}</td></tr>
                <tr><td>Email Contacto:</td><td>${formData.email_contacto || 'N/A'}</td></tr>

                <tr style="background-color: #008080; color: white;">
                    <td colspan="2" style="font-weight: bold;">DATOS DEL TUTOR LEGAL</td>
                </tr>
                <tr><td>Nombre Completo:</td><td>${formData.nombre_tutor}</td></tr>
                <tr><td>Email:</td><td>${formData.email_tutor}</td></tr>
                <tr><td>Teléfono Móvil:</td><td>${formData.telf_movil}</td></tr>
                <tr><td>DNI/NIE:</td><td>${formData.dni_tutor}</td></tr>

                <tr style="background-color: #008080; color: white;">
                    <td colspan="2" style="font-weight: bold;">DATOS DEL MENOR</td>
                </tr>
                <tr><td>Nombre del Menor:</td><td>${formData.nombre_menor}</td></tr>
                <tr><td>Fecha de Nacimiento:</td><td>${formData.fecha_nacimiento}</td></tr>

                <tr style="background-color: #008080; color: white;">
                    <td colspan="2" style="font-weight: bold;">AUTORIZACIONES</td>
                </tr>
                <tr><td>Consentimiento Fotos/Videos:</td><td>${formData.consentimiento_fotos}</td></tr>
                <tr><td>Fecha de Firma:</td><td>${formData.fecha_firma}</td></tr>
            </table>
            
            ${formData.signatureUrl ? `<p style="margin-top: 20px;"><strong>Firma Digital Guardada:</strong> <a href="${formData.signatureUrl}">Ver Firma en Google Drive</a></p>` : ''}
            <p>Este registro ha sido guardado en la Hoja de Cálculo.</p>
        `;
        
        MailApp.sendEmail({
            to: EMAIL_TO,
            cc: EMAIL_CC,
            subject: subject,
            htmlBody: htmlBody
        });
        
        Logger.log('Correo de notificación enviado correctamente.');
        return true;
    } catch (error) {
        Logger.log('Error al enviar correo: ' + error.toString());
        return false; 
    }
}