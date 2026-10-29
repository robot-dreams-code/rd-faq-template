Покладіть сюди файл шрифту з корпоративної ліцензії: `VinMonoPro-Bold.woff2`.

Поки файлу немає, заголовки показуються шрифтом JetBrains Mono (Google Fonts).
Якщо є лише .otf/.ttf, конвертуйте у woff2 (наприклад, `pip install fonttools brotli`, потім
`pyftsubset VinMonoPro-Bold.otf --unicodes="*" --flavor=woff2 --output-file=VinMonoPro-Bold.woff2`).

Перевірте, що ліцензія Vin Mono Pro дозволяє використання на вебі (web font license).
