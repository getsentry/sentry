import styled from '@emotion/styled';

import campingImg from 'sentry-images/spot/onboarding-preview.svg';

import {navigateTo} from 'sentry/actionCreators/navigation';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

function NoIssuesMatched() {
  const organization = useOrganization();
  const router = useRouter();
  return (
    <Wrapper data-test-id="empty-state" className="empty-state">
      <img src={campingImg} alt="Camping spot illustration" height={200} />
      <MessageContainer>
        <h3>{t('No issues match your search')}</h3>
        <div>{t('If this is unexpected, check out these tips:')}</div>
        <Tips>
          <li>{t('Double check your project, environment, and date filters')}</li>
          <li>
            {tct('Make sure your search has the right syntax. [link]', {
              link: (
                <ExternalLink href="https://docs.sentry.io/concepts/search/">
                  {t('Learn more')}
                </ExternalLink>
              ),
            })}
          </li>
          <li>
            {tct(
              "Check your [filterSettings: inbound data filters] to make sure the events aren't being filtered out",
              {
                filterSettings: (
                  <a
                    href="#"
                    onClick={event => {
                      event.preventDefault();
                      const url = `/settings/${organization.slug}/projects/:projectId/filters/data-filters/`;
                      if (router) {
                        navigateTo(url, router);
                      }
                    }}
                  />
                ),
              }
            )}
          </li>
        </Tips>
      </MessageContainer>
    </Wrapper>
  );
}

export default NoIssuesMatched;

const Wrapper = styled('div')`
  display: flex;
  justify-content: center;
  font-size: ${p => p.theme.fontSizeLarge};
  border-radius: 0 0 3px 3px;
  padding: 40px ${space(3)};
  min-height: 260px;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
    align-items: center;
    padding: ${space(3)};
    text-align: center;
  }
`;

const MessageContainer = styled('div')`
  align-self: center;
  max-width: 480px;
  margin-left: 40px;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin: 0;
  }
`;

const Tips = styled('ul')`
  text-align: left;
`;
