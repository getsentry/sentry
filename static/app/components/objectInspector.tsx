import {ComponentProps, MouseEvent, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {
  chromeDark,
  chromeLight,
  ObjectInspector as OrigObjectInspector,
} from '@sentry-internal/react-inspector';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';

type Props = Omit<ComponentProps<typeof OrigObjectInspector>, 'theme'> & {
  onCopy?: (copiedCode: string) => void;
  showCopyButton?: boolean;
  theme?: Record<string, any>;
};

function ObjectInspector({data, onCopy, showCopyButton, theme, ...props}: Props) {
  const config = useLegacyStore(ConfigStore);
  const emotionTheme = useTheme();
  const isDark = config.theme === 'dark';

  const INSPECTOR_THEME = useMemo(
    () => ({
      ...(isDark ? chromeDark : chromeLight),

      // Reset some theme values
      BASE_COLOR: 'inherit',
      ERROR_COLOR: emotionTheme.red400,
      TREENODE_FONT_FAMILY: emotionTheme.text.familyMono,
      TREENODE_FONT_SIZE: 'inherit',
      TREENODE_LINE_HEIGHT: 'inherit',
      BASE_BACKGROUND_COLOR: 'none',
      ARROW_FONT_SIZE: '10px',

      OBJECT_PREVIEW_OBJECT_MAX_PROPERTIES: 1,
      ...theme,
    }),
    [isDark, theme, emotionTheme.red400, emotionTheme.text]
  );

  const inspector = (
    <OrigObjectInspector
      data={data}
      // @ts-expect-error
      theme={INSPECTOR_THEME}
      {...props}
    />
  );
  if (showCopyButton) {
    return (
      <Wrapper>
        <StyledCopyButton
          borderless
          iconSize="xs"
          onCopy={onCopy}
          size="xs"
          text={JSON.stringify(data, null, '\t')}
        />
        <InspectorWrapper>{inspector}</InspectorWrapper>
      </Wrapper>
    );
  }

  return inspector;
}

const InspectorWrapper = styled('div')`
  margin-right: ${space(4)};
`;

const Wrapper = styled('div')`
  position: relative;

  /*
  We need some minimum vertical height so the copy button has room.
  But don't try to use min-height because then whitespace would be inconsistent.
  */
  padding-bottom: ${space(1.5)};
`;

const StyledCopyButton = styled(CopyToClipboardButton)`
  position: absolute;
  top: 0;
  right: ${space(0.5)};
`;

export type OnExpandCallback = (
  path: string,
  expandedState: Record<string, boolean>,
  event: MouseEvent<HTMLDivElement>
) => void;

export default ObjectInspector;
