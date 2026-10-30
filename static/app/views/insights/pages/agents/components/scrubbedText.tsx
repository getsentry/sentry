import {createContext, Fragment, useContext, useMemo} from 'react';

import {InfoText} from '@sentry/scraps/info';

import {getTooltipText} from 'sentry/components/events/meta/annotatedText/utils';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  NO_SCRUBBED_PLACEHOLDERS,
  type ScrubbedPlaceholders,
} from 'sentry/views/insights/pages/agents/utils/scrubbedPlaceholders';

const ScrubbedPlaceholdersContext = createContext<ScrubbedPlaceholders>(
  NO_SCRUBBED_PLACEHOLDERS
);

/** Marks the replacement texts in the AI content rendered below it as scrubbed. */
export const ScrubbedPlaceholdersProvider = ScrubbedPlaceholdersContext.Provider;

/** Whether the AI content rendered here contains any scrubbed replacement texts. */
export function useHasScrubbedPlaceholders(): boolean {
  return useContext(ScrubbedPlaceholdersContext).size > 0;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Renders text, explaining each replacement text that PII scrubbing inserted, like
 * `[email]`, in a tooltip.
 */
export function ScrubbedText({children}: {children: string}) {
  const placeholders = useContext(ScrubbedPlaceholdersContext);
  const organization = useOrganization({allowNull: true}) ?? undefined;

  const pattern = useMemo(
    () =>
      placeholders.size === 0
        ? null
        : new RegExp(`(${Array.from(placeholders.keys(), escapeRegExp).join('|')})`),
    [placeholders]
  );

  if (!pattern) {
    return <Fragment>{children}</Fragment>;
  }

  // The capturing group keeps the placeholders, at the odd indices.
  return (
    <Fragment>
      {children.split(pattern).map((part, index) => {
        const placeholder = index % 2 === 1 ? placeholders.get(part) : undefined;
        if (!placeholder) {
          return part;
        }
        return (
          <InfoText
            key={index}
            variant="inherit"
            title={getTooltipText({
              remark: placeholder.remark,
              rule_id: placeholder.ruleId,
              organization,
            })}
          >
            {part}
          </InfoText>
        );
      })}
    </Fragment>
  );
}
