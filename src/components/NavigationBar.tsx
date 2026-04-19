type ViewMode = "dashboard" | "yolo";

interface NavigationBarProps {
  title: string;
  darkMode: boolean;
  onToggleDark: () => void;
  view: ViewMode;
  onChangeView: (view: ViewMode) => void;
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function NavigationBar({
  title,
  darkMode,
  onToggleDark,
  view,
  onChangeView,
}: NavigationBarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2 flex items-center justify-between transition-colors">
      {/* Left: title */}
      <div className="flex items-center gap-3">
        <span className="text-red-500 text-xl">🏥</span>
        <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight">
          {title}
        </h1>
      </div>

      {/* Center: view tabs */}
      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
        <button
          onClick={() => onChangeView("dashboard")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === "dashboard"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          🤖 AI Agent
        </button>
        <button
          onClick={() => onChangeView("yolo")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            view === "yolo"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          📦 YOLO Detection
        </button>
      </div>

      {/* Right: dark mode toggle */}
      <button
        onClick={onToggleDark}
        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {darkMode ? <SunIcon /> : <MoonIcon />}
      </button>
    </nav>
  );
}
