/**
 * Налаштування FAQ для одного курсу.
 * Для нового курсу зазвичай достатньо змінити лише sheetId.
 * Усе інше (назва курсу, теги, контакти, акцентний колір) береться з вкладки settings у таблиці.
 */
window.FAQ_CONFIG = {
  // ID таблиці з її адреси: https://docs.google.com/spreadsheets/d/<ОСЬ_ЦЕЙ_ID>/edit
  // Таблиця має бути відкрита: «Усі, хто має посилання — Читач».
  sheetId: "",

  // Назви вкладок у таблиці
  faqSheet: "faq",
  settingsSheet: "settings",

  // Альтернатива sheetId: прямі CSV-посилання з «Файл → Поділитися → Опублікувати в інтернеті».
  // Якщо заповнені — мають пріоритет над sheetId.
  faqCsvUrl: "",
  settingsCsvUrl: "",

  // "live"     — сторінка читає таблицю напряму, а при помилці показує резервну копію з data/
  // "snapshot" — сторінка читає лише data/*.csv (їх оновлює GitHub Action)
  source: "live",

  snapshot: {
    faq: "data/faq.csv",
    settings: "data/settings.csv",
  },

  // Необов'язково: шлях до офіційного SVG-логотипа (наприклад, "assets/logo.svg").
  // Якщо порожньо — малюється логотип-плашка r_d з підписом із settings.subbrand.
  logoSrc: "",

  // Значення за замовчуванням, якщо в settings чогось немає
  defaults: {
    course_name: "Часті запитання",
    course_subtitle: "",
    subbrand: "faq",
    accent: "#4BD86A",
    site_url: "https://robotdreams.cc",
    site_label: "robotdreams.cc",
    contact_title: "Не знайшли відповідь?",
    contact_text: "",
    contact_label: "Написати нам",
    contact_url: "",
  },
};
