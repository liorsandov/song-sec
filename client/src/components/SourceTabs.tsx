type SourceTabOption<T extends string> = {
  value: T;
  label: string;
};

type SourceTabsProps<T extends string> = {
  options: readonly SourceTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SourceTabs<T extends string>({
  options,
  value,
  onChange
}: SourceTabsProps<T>) {
  return (
    <div aria-label="Download source" className="source-tabs glass-tabs" role="tablist">
      {options.map((option) => (
        <button
          aria-selected={value === option.value}
          className={`source-tab ${value === option.value ? "is-active" : ""}`}
          key={option.value}
          onClick={() => onChange(option.value)}
          role="tab"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
