const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

const templates = {};

const loadTemplates = () => {

    const templateDir = path.join(__dirname, 'templates');
    const files = fs.readdirSync(templateDir).filter((f) => f.endsWith('.hbs'));

    if (files.length === 0) {
        throw new Error('No email templates found in ' + templateDir);
    }

    for (const file of files) {
        const name = path.basename(file, '.hbs');
        const source = fs.readFileSync(path.join(templateDir, file), 'utf8');
        templates[name] = handlebars.compile(source);
    }
};

const render = (templateName, context) => {
    if (!templates[templateName]) {
        throw new Error(`Email template not found: ${templateName}`);
    }
    return templates[templateName](context);
};

module.exports = { loadTemplates, render };
