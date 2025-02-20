import type {AlertProps} from 'sentry/components/alert';
import {chonkStyled, useChonkTheme} from 'sentry/utils/theme/theme.chonk';
import type {ChonkPropMapping} from 'sentry/utils/theme/withChonk';

const chonkAlertPropMapping: ChonkPropMapping<AlertProps, ChonkAlertProps> = props => {
  return {
    ...props,
    type:
      props.type === 'muted' ? 'subtle' : props.type === 'error' ? 'danger' : props.type,
  };
};

interface ChonkAlertProps extends Omit<AlertProps, 'type'> {
  type: 'subtle' | 'info' | 'warning' | 'success' | 'danger';
  size?: 'sm';
}

function AlertPanel({type, size, ...props}: ChonkAlertProps) {
  const theme = useChonkTheme();

  return (
    <AlertPanelDiv
      {...props}
      colors={chonkAlertTheme(type, theme)}
      padding={chonkAlertPadding(size, theme)}
    >
      {props.children}
    </AlertPanelDiv>
  );
}

const AlertPanelDiv = chonkStyled('div')<
  Omit<ChonkAlertProps, 'type'> & {
    colors: ReturnType<typeof chonkAlertTheme>;
    padding: ReturnType<typeof chonkAlertPadding>;
  }
>`
  background-color: ${p => p.colors.background};
  color: ${p => p.colors.color};
  border: ${p => p.colors.border};
  border-width: ${p => (p.system ? '0px 0px 2px 0px' : '2px')};
  border-radius: ${p => (p.system ? '0px' : p.theme.borderRadius)};
  padding: ${p => p.padding};

  cursor: ${p => (p.expand ? 'pointer' : 'default')};

  display: grid;
  grid-template-columns:
    ${p => (p.showIcon ? `minmax(0, max-content)` : '0fr')}
    minmax(0, 1fr)
    ${p => (p.trailingItems ? `max-content` : '0fr')}
    ${p => (p.expand ? `max-content` : '0fr')};

  gap: ${p => p.theme.space.md};

  a,
  button {
    color: inherit;
  }

  a:hover,
  button:hover {
    color: inherit;
  }

  a {
    text-decoration: underline;
  }
`;

function chonkAlertPadding(
  size: ChonkAlertProps['size'],
  theme: ReturnType<typeof useChonkTheme>
) {
  switch (size) {
    case 'sm':
      return `${theme.space.mini} ${theme.space.md}`;
    default:
      return `${theme.space.md} ${theme.space.lg}`;
  }
}

function chonkAlertTheme(
  type: ChonkAlertProps['type'],
  theme: ReturnType<typeof useChonkTheme>
) {
  switch (type) {
    case 'info':
      return {
        color: theme.colors.static.white,
        background: theme.colors.static.blurple400,
        border: `2px solid ${theme.colors.static.blurple400}`,
      };
    case 'success':
      return {
        color: theme.colors.static.black,
        background: theme.colors.static.green400,
        border: `2px solid ${theme.colors.dynamic.green100}`,
      };
    case 'warning':
      return {
        color: theme.colors.static.black,
        background: theme.colors.static.gold400,
        border: `2px solid ${theme.colors.dynamic.gold100}`,
      };
    case 'danger':
      return {
        color: theme.colors.static.white,
        background: theme.colors.static.red400,
        border: `2px solid ${theme.colors.dynamic.red100}`,
      };
    case 'subtle':
      return {
        color: theme.textColor,
        background: theme.colors.dynamic.surface400,
        border: `2px solid ${theme.colors.dynamic.surface100}`,
      };

    default:
      unreachable(type);
  }

  throw new TypeError(`Invalid alert type, got ${type}`);
}

function unreachable(x: never) {
  return x;
}

export {AlertPanel, chonkAlertPropMapping};
