import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import ZendeskLink from 'getsentry/components/zendeskLink';

type Props = {
  closeModal: () => void;
  organization: Organization;
};

function HelpSearchFooter({organization, closeModal}: Props) {
  return (
    <Container>
      {t('Need personalized help? Contact our support team!')}
      <ZendeskLink
        source="help_modal"
        organization={organization}
        Component={({href, onClick}) => (
          <LinkButton
            href={href}
            size="sm"
            onClick={e => {
              onClick(e);
              closeModal();
            }}
          >
            {t('Contact Us')}
          </LinkButton>
        )}
      />
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(2)};
  background: ${p => p.theme.background};
  border-top: 1px solid ${p => p.theme.border};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default HelpSearchFooter;
