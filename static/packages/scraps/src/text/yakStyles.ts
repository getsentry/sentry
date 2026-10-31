import {addLayoutProp, type LayoutStyle} from '@sentry/scraps/layout/yakLayout';

import {getTextDecoration} from './styles';
import type {BaseTextProps} from './text';

export const textStyleProps: ReadonlySet<string> = new Set([
  'as',
  'align',
  'bold',
  'cursor',
  'density',
  'display',
  'ellipsis',
  'fraction',
  'italic',
  'monospace',
  'size',
  'strikethrough',
  'tabular',
  'textWrap',
  'trim',
  'underline',
  'uppercase',
  'variant',
  'wordBreak',
  'wrap',
]);

export function addTextStyles(acc: LayoutStyle, props: BaseTextProps) {
  const theme = acc.theme;
  addLayoutProp(acc, 'textAlign', props.align);
  addLayoutProp(acc, 'fontStyle', props.italic ? 'italic' : undefined);
  addLayoutProp(acc, 'textDecoration', getTextDecoration(props) || undefined);
  addLayoutProp(acc, 'cursor', props.cursor);
  addLayoutProp(
    acc,
    'color',
    props.variant === 'inherit'
      ? undefined
      : theme.tokens.content[
          props.variant === 'muted' ? 'secondary' : (props.variant ?? 'primary')
        ]
  );
  addLayoutProp(acc, 'overflow', props.ellipsis ? 'hidden' : undefined);
  addLayoutProp(acc, 'textOverflow', props.ellipsis ? 'ellipsis' : undefined);
  addLayoutProp(acc, 'whiteSpace', props.wrap ?? (props.ellipsis ? 'nowrap' : undefined));
  addLayoutProp(acc, 'textWrap', props.textWrap);
  addLayoutProp(acc, 'wordBreak', props.wordBreak);
  addLayoutProp(acc, 'fontFamily', theme.font.family[props.monospace ? 'mono' : 'sans']);
  addLayoutProp(
    acc,
    'fontVariantNumeric',
    [props.tabular && 'tabular-nums', props.fraction && 'diagonal-fractions']
      .filter(Boolean)
      .join(' ') || undefined
  );
  addLayoutProp(acc, 'textBoxEdge', 'text text');
  addLayoutProp(acc, 'textBoxTrim', props.trim === false ? 'none' : 'trim-both');
  addLayoutProp(acc, 'margin', '0');
  addLayoutProp(acc, 'padding', '0');
}
