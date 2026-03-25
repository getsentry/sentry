import {components as selectComponents} from 'sentry/components/forms/controls/reactSelectWrapper';
import {IconSearch} from 'sentry/icons';

/**
 * Custom Control that prepends a search icon inside a Select input.
 * Control is the outermost flex container around ValueContainer + Indicators,
 * so adding a child here doesn't break react-select's internal layout.
 *
 * Props are typed as `any` because react-select's generic types don't
 * match the specific option shape our Select wrapper uses, and there's
 * no clean way to type custom components without casting. This matches
 * the pattern used elsewhere (e.g. ruleConditionsForm, typeSelector).
 */
export function ScmSearchControl({children, ...props}: any) {
  return (
    <selectComponents.Control {...props}>
      <IconSearch size="sm" variant="muted" style={{marginLeft: 12, flexShrink: 0}} />
      {children}
    </selectComponents.Control>
  );
}
