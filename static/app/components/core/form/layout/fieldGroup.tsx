import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {Panel} from 'sentry/components/panels/panel';
import {PanelHeader} from 'sentry/components/panels/panelHeader';

export function FieldGroup({
  title,
  children,
  hasButtons,
}: {
  children: React.ReactNode;
  hasButtons?: boolean;
  title?: React.ReactNode;
}) {
  return (
    <Panel>
      {title ? <PanelHeader hasButtons={hasButtons}>{title}</PanelHeader> : null}
      <PanelBody>{children}</PanelBody>
    </Panel>
  );
}

const PanelBody = styled(Container)`
  > * {
    padding: ${p => p.theme.space.xl};
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }

  > *:last-child {
    border-bottom: none;
  }

  /*
   * A direct child <form> (AutoSaveForm / useScrapsForm) is transparent for
   * layout: unstyle the form element itself and apply the row styles to its
   * first-level children instead, so every field row gets its own padding and
   * divider. This only reaches one level deep.
   *
   * The base "> *" selector above is intentionally left untouched (rather than
   * "> *:not(form)") so its specificity stays equal to a directly-nested
   * component's own styles — e.g. an <Alert> rendered straight inside a
   * FieldGroup still overrides the row padding as it did before.
   */
  > form {
    padding: 0;
    border-bottom: none;
  }

  > form > * {
    padding: ${p => p.theme.space.xl};
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }

  > form:last-child > *:last-child {
    border-bottom: none;
  }
`;
