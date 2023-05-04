import {ComponentProps, MouseEvent, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {
  chromeDark,
  chromeLight,
  ObjectInspector as OrigObjectInspector,
} from '@sentry-internal/react-inspector';

import {Button} from 'sentry/components/button';
import Clipboard from 'sentry/components/clipboard';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

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

  const [tooltipState, setTooltipState] = useState<'copy' | 'copied' | 'error'>('copy');

  const tooltipTitle =
    tooltipState === 'copy'
      ? t('Copy')
      : tooltipState === 'copied'
      ? t('Copied')
      : t('Unable to copy');

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
        <Clipboard
          value={JSON.stringify(data, null, '\t')}
          onSuccess={() => {
            setTooltipState('copied');
            onCopy?.(data);
          }}
          onError={() => {
            setTooltipState('error');
          }}
        >
          <CopyButton
            type="button"
            size="xs"
            translucentBorder
            borderless
            title={tooltipTitle}
            tooltipProps={{delay: 0, isHoverable: false, position: 'left'}}
            onMouseLeave={() => setTooltipState('copy')}
          >
            <IconCopy size="xs" />
          </CopyButton>
        </Clipboard>
        {inspector}
      </Wrapper>
    );
  }

  return inspector;
}

const Wrapper = styled('div')`
  position: relative;
`;

const CopyButton = styled(Button)`
  position: absolute;
  top: 0;
  right: 0;

  color: ${p => p.theme.subText};
`;

export type OnExpandCallback = (
  path: string,
  expandedState: Record<string, boolean>,
  event: MouseEvent<HTMLDivElement>
) => void;

export default ObjectInspector;
