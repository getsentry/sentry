import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {EditOwnershipRulesModalOptions} from 'sentry/actionCreators/modal';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import OwnerInput from 'sentry/views/settings/project/projectOwnership/ownerInput';

interface EditOwnershipRulesModalProps extends EditOwnershipRulesModalOptions {
  onCancel: () => void;
}

export function EditOwnershipRules({ownership, ...props}: EditOwnershipRulesModalProps) {
  const email = ConfigStore.get('user')?.email ?? '#team-slug';

  return (
    <Fragment>
      <Fragment>
        <Description>
          {tct(
            'Assign issues based on custom rules. To learn more, [docs:read the docs].',
            {
              docs: (
                <ExternalLink href="https://docs.sentry.io/product/issues/issue-owners/" />
              ),
            }
          )}
        </Description>
        <StyledPre>
          # {t("Here's an example")}
          <br />
          path:src/views/checkout {email}
          <br />
          url:https://example.com/checkout {email}
          <br />
          tags.transaction:/checkout/:page {email}
        </StyledPre>
      </Fragment>
      {ownership && (
        <OwnerInput
          {...props}
          dateUpdated={ownership.lastUpdated}
          initialText={ownership.raw || ''}
          page="project_settings"
        />
      )}
    </Fragment>
  );
}

const StyledPre = styled('pre')`
  word-break: break-word;
  padding: ${space(2)};
  line-height: 1.6;
  color: ${p => p.theme.subText};
`;

const Description = styled('p')`
  margin-bottom: ${space(1)};
`;
