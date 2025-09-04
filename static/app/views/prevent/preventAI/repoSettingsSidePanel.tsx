import {useState} from 'react';
import styled from '@emotion/styled';

import {Switch} from 'sentry/components/core/switch';
import {Text} from 'sentry/components/core/text';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface RepoSettingsSidePanelProps {
  collapsed: boolean;
  onClose: () => void;
}

// Styled Components
const PanelContainer = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};
`;

const PanelHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: ${space(3)};
  border-bottom: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  flex-shrink: 0;
`;

const HeaderContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  flex: 1;
`;

const Title = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.xl};
  color: ${p => p.theme.headingColor};
`;

const CloseButton = styled(IconClose)`
  color: ${p => p.theme.subText};
  cursor: pointer;
  padding: ${space(0.75)};

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const PanelContent = styled('div')`
  flex: 1;
  overflow-y: auto;
  padding: ${space(2)};
`;

const ContentSection = styled('div')`
  margin-bottom: ${space(3)};
`;

const SectionTitle = styled('h4')`
  margin: 0 0 ${space(1)} 0;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.headingColor};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const ToggleSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ToggleItem = styled('div')<{isSubmenu?: boolean}>`
  border-radius: ${space(1)};
  padding: ${p =>
    p.isSubmenu ? `${space(2)} ${space(2)} ${space(2)} ${space(4)}` : space(2)};
  background: ${p => (p.isSubmenu ? p.theme.backgroundSecondary : p.theme.background)};
  border: 1px solid ${p => (p.isSubmenu ? p.theme.border : 'transparent')};
  transition: background-color 0.2s ease;

  &:hover {
    background: ${p =>
      p.isSubmenu ? p.theme.backgroundTertiary : p.theme.backgroundSecondary};
  }
`;

const ToggleLabel = styled('label')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(2)};
  cursor: pointer;
  width: 100%;
`;

const ToggleLabelContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  flex: 1;
`;

const ToggleLabelTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.headingColor};
`;

const ToggleLabelDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const SubmenuSection = styled('div')`
  margin-top: ${space(3)};
  padding-left: ${space(2)};
  border-left: 2px solid ${p => p.theme.border};
`;

const SubmenuTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.headingColor};
  margin-bottom: ${space(2)};
`;

export default function RepoSettingsSidePanel({
  collapsed,
  onClose,
}: RepoSettingsSidePanelProps) {
  const [prReviewEnabled, setPrReviewEnabled] = useState(false);
  const [testGenerationEnabled, setTestGenerationEnabled] = useState(false);
  const [errorPredictionEnabled, setErrorPredictionEnabled] = useState(false);
  const [errorPredictionFrameworks, setErrorPredictionFrameworks] = useState(false);
  const [errorPredictionPatterns, setErrorPredictionPatterns] = useState(false);

  return (
    <SlideOverPanel
      collapsed={collapsed}
      onOpen={() => {}}
      slidePosition="right"
      panelWidth="340px"
      ariaLabel="Prevent AI Settings"
    >
      <PanelContainer>
        <PanelHeader>
          <HeaderContent>
            <Title>{t('Prevent AI Settings')}</Title>
            <Text size="sm" variant="muted">
              {t(
                'These settings apply to the selected repository. To switch, use the repository selector in the page header.'
              )}
            </Text>
          </HeaderContent>
          <CloseButton size="lg" onClick={onClose} aria-label={t('Close Panel')} />
        </PanelHeader>
        <PanelContent>
          <ContentSection>
            <SectionTitle>{t('AI Features')}</SectionTitle>
            <Text size="sm" variant="muted" style={{marginBottom: space(3)}}>
              {t('Configure which AI features are enabled for this repository.')}
            </Text>

            <ToggleSection>
              <ToggleItem>
                <ToggleLabel htmlFor="pr-review">
                  <ToggleLabelContent>
                    <ToggleLabelTitle>{t('Enable PR Review')}</ToggleLabelTitle>
                    <ToggleLabelDescription>
                      {t('AI-powered code review suggestions on pull requests')}
                    </ToggleLabelDescription>
                  </ToggleLabelContent>
                  <Switch
                    id="pr-review"
                    checked={prReviewEnabled}
                    onChange={() => setPrReviewEnabled(!prReviewEnabled)}
                    size="lg"
                  />
                </ToggleLabel>
              </ToggleItem>

              <ToggleItem>
                <ToggleLabel htmlFor="test-generation">
                  <ToggleLabelContent>
                    <ToggleLabelTitle>{t('Enable Test Generation')}</ToggleLabelTitle>
                    <ToggleLabelDescription>
                      {t('Automatically generate unit tests for new code')}
                    </ToggleLabelDescription>
                  </ToggleLabelContent>
                  <Switch
                    id="test-generation"
                    checked={testGenerationEnabled}
                    onChange={() => setTestGenerationEnabled(!testGenerationEnabled)}
                    size="lg"
                  />
                </ToggleLabel>
              </ToggleItem>

              <ToggleItem>
                <ToggleLabel htmlFor="error-prediction">
                  <ToggleLabelContent>
                    <ToggleLabelTitle>{t('Enable Error Prediction')}</ToggleLabelTitle>
                    <ToggleLabelDescription>
                      {t('Predict potential errors before they happen')}
                    </ToggleLabelDescription>
                  </ToggleLabelContent>
                  <Switch
                    id="error-prediction"
                    checked={errorPredictionEnabled}
                    onChange={() => setErrorPredictionEnabled(!errorPredictionEnabled)}
                    size="lg"
                  />
                </ToggleLabel>

                {errorPredictionEnabled && (
                  <SubmenuSection>
                    <SubmenuTitle>{t('Error Prediction Options')}</SubmenuTitle>

                    <ToggleItem isSubmenu>
                      <ToggleLabel htmlFor="prediction-frameworks">
                        <ToggleLabelContent>
                          <ToggleLabelTitle>{t('Framework Analysis')}</ToggleLabelTitle>
                          <ToggleLabelDescription>
                            {t('Analyze framework-specific error patterns')}
                          </ToggleLabelDescription>
                        </ToggleLabelContent>
                        <Switch
                          id="prediction-frameworks"
                          checked={errorPredictionFrameworks}
                          onChange={() =>
                            setErrorPredictionFrameworks(!errorPredictionFrameworks)
                          }
                          size="lg"
                        />
                      </ToggleLabel>
                    </ToggleItem>

                    <ToggleItem isSubmenu>
                      <ToggleLabel htmlFor="prediction-patterns">
                        <ToggleLabelContent>
                          <ToggleLabelTitle>
                            {t('Code Pattern Analysis')}
                          </ToggleLabelTitle>
                          <ToggleLabelDescription>
                            {t('Detect problematic code patterns and anti-patterns')}
                          </ToggleLabelDescription>
                        </ToggleLabelContent>
                        <Switch
                          id="prediction-patterns"
                          checked={errorPredictionPatterns}
                          onChange={() =>
                            setErrorPredictionPatterns(!errorPredictionPatterns)
                          }
                          size="lg"
                        />
                      </ToggleLabel>
                    </ToggleItem>
                  </SubmenuSection>
                )}
              </ToggleItem>
            </ToggleSection>
          </ContentSection>
        </PanelContent>
      </PanelContainer>
    </SlideOverPanel>
  );
}
