import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import preventAiComment1 from 'sentry-images/codecov/prevent-ai-comment-1.png';
import preventAiCommentLight from 'sentry-images/codecov/Prevent-AI-img-light-mode.png';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import DropdownButton from 'sentry/components/dropdownButton';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {IconBuilding} from 'sentry/icons/iconBuilding';
import {IconRepository} from 'sentry/icons/iconRepository';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

// Mock data for demonstration - replace with actual data
const organizationOptions = [
  {value: 'turing-corp', label: 'Turing-Corp'},
  {value: 'Example Org-1', label: 'Example Org-1'},
  {value: 'Example Org-2', label: 'Example Org-2'},
];

const repositoryOptions = [
  {value: 'enigma', label: 'enigma'},
  {value: 'all repositories', label: 'All repositories'},
  {value: 'example-repo-1', label: 'example-repo-1'},
  {value: 'example-repo-2', label: 'example-repo-2'},
];

export default function AIPage() {
  const [selectedOrg, setSelectedOrg] = useState('turing-corp');
  const [selectedRepo, setSelectedRepo] = useState('enigma');
  const config = useLegacyStore(ConfigStore);
  const isDarkMode = config.theme === 'dark';

  return (
    <Fragment>
      <ControlsContainer>
        <PageFilterBar condensed>
          <CompactSelect
            value={selectedOrg}
            options={organizationOptions}
            onChange={option => setSelectedOrg(String(option?.value))}
            trigger={(triggerProps, isOpen) => (
              <DropdownButton
                isOpen={isOpen}
                data-test-id="page-filter-org-selector"
                {...triggerProps}
              >
                <TriggerLabelWrap>
                  <Flex align="center" gap="sm">
                    <IconContainer>
                      <IconBuilding />
                    </IconContainer>
                    <TriggerLabel>
                      {organizationOptions.find(opt => opt.value === selectedOrg)
                        ?.label || t('Select organization')}
                    </TriggerLabel>
                  </Flex>
                </TriggerLabelWrap>
              </DropdownButton>
            )}
          />

          <CompactSelect
            value={selectedRepo}
            options={repositoryOptions}
            onChange={option => setSelectedRepo(String(option?.value))}
            trigger={(triggerProps, isOpen) => (
              <DropdownButton
                isOpen={isOpen}
                data-test-id="page-filter-repo-selector"
                {...triggerProps}
              >
                <TriggerLabelWrap>
                  <Flex align="center" gap="sm">
                    <IconContainer>
                      <IconRepository />
                    </IconContainer>
                    <TriggerLabel>
                      {repositoryOptions.find(opt => opt.value === selectedRepo)?.label ||
                        t('Select repo')}
                    </TriggerLabel>
                  </Flex>
                </TriggerLabelWrap>
              </DropdownButton>
            )}
          />
        </PageFilterBar>
      </ControlsContainer>

      <SetupGuidePanel>
        <SetupContainer>
          <SetupContentWrapper>
            <SetupContent>
              <SetupHeader>
                <SetupTitle>{t('Manage Repositories')}</SetupTitle>
                <SetupDescription>
                  {t('To install more repositories or uninstall the app, go to your')}{' '}
                  <ExternalLink href="https://github.com/settings/installations/73320269">
                    {t('Seer by Sentry app')}
                  </ExternalLink>{' '}
                  {t('on GitHub.')}
                </SetupDescription>
              </SetupHeader>

              <Divider />

              <InfoBox>
                <InfoContent>
                  <InfoTitle>{t('How to use Prevent AI')}</InfoTitle>
                  <InfoDescription>
                    {t('Prevent AI helps you ship better code with three features:')}
                  </InfoDescription>
                  <InfoList>
                    <InfoListItem>
                      {t(
                        'It reviews your code, suggesting broader fixes when you prompt '
                      )}{' '}
                      <PurpleText>@sentry review</PurpleText>.
                    </InfoListItem>
                    <InfoListItem>
                      {t(
                        'It predicts which errors your code will cause. This happens automatically when you mark a PR ready for review, and when you trigger a PR review with '
                      )}{' '}
                      <PurpleText>@sentry review</PurpleText>.
                    </InfoListItem>
                    <InfoListItem>
                      {t('It generates unit tests for your PR when you prompt ')}{' '}
                      <PurpleText>@sentry generate-test</PurpleText>.
                    </InfoListItem>
                  </InfoList>
                  <InfoNote>
                    {t(
                      'Sentry Error Prediction works better with Sentry Issue Context. '
                    )}{' '}
                    <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/sentry-prevent-ai/">
                      {t('Learn more')}
                    </ExternalLink>{' '}
                    {t(
                      'on how to set this up to get the most accurate error prediction we can offer.'
                    )}
                  </InfoNote>
                </InfoContent>
              </InfoBox>
            </SetupContent>

            <SetupImageColumn>
              <BasePreventAiImage
                src={isDarkMode ? preventAiComment1 : preventAiCommentLight}
                alt="Prevent AI PR comment example"
              />
            </SetupImageColumn>
          </SetupContentWrapper>
        </SetupContainer>
      </SetupGuidePanel>
    </Fragment>
  );
}

const ControlsContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xl};
  flex-wrap: wrap;
  align-items: center;
  padding-bottom: 20px;

  /* Mobile responsive adjustments */
  @media (max-width: 767px) {
    gap: ${p => p.theme.space.md};
    flex-direction: column;
    align-items: stretch;
  }

  @media (max-width: 1023px) {
    gap: ${p => p.theme.space.lg};
  }
`;

const TriggerLabelWrap = styled('span')`
  position: relative;
  min-width: 0;
  max-width: 200px;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
`;

const IconContainer = styled('div')`
  flex: 1 0 14px;
  height: 14px;
`;

const SetupGuidePanel = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  margin-bottom: ${p => p.theme.space.xl};
  position: relative;
`;

const SetupContainer = styled('div')`
  padding: ${p => p.theme.space['2xl']} ${p => p.theme.space['3xl']};
  max-width: 1230px;
  margin: 0 auto;
`;

const SetupHeader = styled('div')`
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const SetupTitle = styled('h3')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: 26px;
  line-height: ${p => p.theme.text.lineHeightHeading};
  color: ${p => p.theme.tokens.content.primary};
  margin: 0 0 ${p => p.theme.space.xs} 0;
`;

const SetupDescription = styled('p')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.tokens.content.primary};
  margin: 0;
  max-width: 621px;
`;

const Divider = styled('div')`
  height: 1px;
  background: ${p => p.theme.tokens.border.primary};
  margin: ${p => p.theme.space['2xl']} 0;
`;

const InfoBox = styled('div')`
  background: ${p => p.theme.tokens.background.secondary};
  border: 1px solid ${p => p.theme.tokens.border.muted};
  border-radius: 8px;
  padding: ${p => p.theme.space['2xl']} ${p => p.theme.space['2xl']};
  margin-bottom: ${p => p.theme.space['2xl']};
  max-width: 657px;
`;

const InfoContent = styled('div')`
  max-width: 610px;
`;

const InfoTitle = styled('h4')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.tokens.content.primary};
  margin: 0 0 ${p => p.theme.space.md} 0;
`;

const InfoDescription = styled('p')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.tokens.content.primary};
  margin: 0 0 ${p => p.theme.space.md} 0;
`;

const InfoList = styled('ul')`
  margin: 0 0 ${p => p.theme.space.xl} 0;
  padding-left: ${p => p.theme.space.xl};
`;

const InfoListItem = styled('li')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.tokens.content.primary};
  margin-bottom: ${p => p.theme.space.xs};

  &:last-child {
    margin-bottom: 0;
  }
`;

const InfoNote = styled('p')`
  font-family: ${p => p.theme.text.family};
  font-weight: ${p => p.theme.fontWeight.normal};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.tokens.content.muted};
  margin: 0;
`;

const SetupContentWrapper = styled('div')`
  display: flex;
  gap: ${p => p.theme.space['2xl']};
  align-items: flex-start;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: column;
  }
`;

const SetupContent = styled('div')`
  flex: 1.5;
  min-width: 0;
`;

const SetupImageColumn = styled('div')`
  flex: 1;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    max-width: 100%;
    align-self: center;
  }
`;

const BasePreventAiImage = styled('img')`
  width: 100%;
  height: 650px;
  border-radius: 8px;
  object-fit: contain;
`;

const PurpleText = styled('span')`
  color: ${p => p.theme.tokens.content.accent};
  font-weight: ${p => p.theme.fontWeight.bold};
`;
