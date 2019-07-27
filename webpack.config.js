/* модуль для скрещивания относительного пути к папке с абсолютным */
let path = require('path')

/* файл настроек */
let conf = {
    /* папка исходников*/
    entry: './src/scripts.js',
    /* папка с билдом. необходимо указать имя файла и абсолютный путь к директории */
    output: {
        path: path.resolve(__dirname, './public'),
        filename: 'main.js',
        /* для настройки дев сервера чтоб видел откуда брать файл main.js */
        publicPath: 'public/'
    },
    devServer: {
        /* во время ошибок будет выводиться окно поверх всего с описанием */
        overlay: true
    },
    module: {
        /* правила загрузки файлов */
        /* вписываем обьекты и указываем как мы поступаем с каждым расширением */
        rules: [
            {
                test: /\.js$/,
                loader: 'babel-loader',
            },
            {
                test: /\.scss$/,
                use: [
                    "style-loader", // creates style nodes from JS strings
                    "css-loader", // translates CSS into CommonJS
                    "sass-loader" // compiles Sass to CSS, using Node Sass by default
                ]
            }
        ]
    }
}

module.exports = conf