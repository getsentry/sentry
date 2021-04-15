export const getToggleTheme = ({
  isExpanded,
  theme,
  disabled,
}: {
  isExpanded: boolean;
  theme: any;
  disabled: boolean;
}) => {
  const buttonTheme = isExpanded ? theme.button.default : theme.button.primary;

  if (disabled) {
    return `
    background: ${buttonTheme.background};
    border: 1px solid ${theme.border};
    color: ${buttonTheme.color};
    cursor: default;
  `;
  }

  return `
    background: ${buttonTheme.background};
    border: 1px solid ${theme.border};
    color: ${buttonTheme.color};
  `;
};
