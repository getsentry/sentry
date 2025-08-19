import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';

import discordLove from 'sentry-images/avatarLoading/discord-stickers-love.png';
import discordSurprised from 'sentry-images/avatarLoading/discord-stickers-surprised.png';
import healthBenefits from 'sentry-images/avatarLoading/healthBenefits.png';
import incomeProtection from 'sentry-images/avatarLoading/incomeProtection.png';
import inOfficePerks from 'sentry-images/avatarLoading/inOfficePerks.png';
import learningBenefits from 'sentry-images/avatarLoading/learningBenefits.png';
import parentalLeave from 'sentry-images/avatarLoading/parentalLeave.png';
import philanthropy from 'sentry-images/avatarLoading/philanthropy.png';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Heading} from 'sentry/components/core/text/heading';
import {Hovercard} from 'sentry/components/hovercard';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconEdit, IconImage} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {AvatarUser} from 'sentry/types/user';
import {fetchMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

import {AvatarCropper} from './avatarCropper';

// These values must be synced with the avatar endpoint in backend.
const MIN_DIMENSION = 256;
const MAX_DIMENSION = 1024;

interface AiAvatarModalProps extends ModalRenderProps {
  endpoint: string;

  currentEntity?: AvatarUser | Organization;
  onSave?: (entity: AvatarUser | Organization) => void;
}

const FUNNY_GENERATION_IMAGES: string[] = [
  discordLove,
  discordSurprised,
  healthBenefits,
  incomeProtection,
  inOfficePerks,
  learningBenefits,
  parentalLeave,
  philanthropy,
];

const LOADING_MESSAGES = [
  t('Initializing awesome\u2026'),
  t('Catching avatar exceptions\u2026'),
  t('Optimizing your pixels\u2026'),
  t('Compiling charisma\u2026'),
  t('Deploying personality\u2026'),
  t('Handling edge cases in your jawline\u2026'),
  t('Rolling back to a better hairstyle\u2026'),
  t('Monitoring your coolness levels\u2026'),
];

const PROMPT_SUGGESTIONS = [
  {
    prompt:
      'A heroic bug slayer with a cape, wielding a debugging sword against colorful code monsters',
    category: t('Bug Slayer'),
  },
  {
    prompt:
      'A wizard casting spells with floating error messages turning into butterflies',
    category: t('Error Whisperer'),
  },
  {
    prompt: 'A detective with a magnifying glass examining tiny stack traces, noir style',
    category: t('Stack Detective'),
  },
  {
    prompt: 'A superhero with performance metrics as superpowers, comic book style',
    category: t('Perf Hero'),
  },
  {
    prompt: 'A friendly robot made of monitoring dashboards and alert notifications',
    category: t('Alert Bot'),
  },
  {
    prompt:
      'A coffee-powered developer surrounded by floating semicolons and curly braces',
    category: t('Code Caffeine'),
  },
];

export function AiAvatarModal({
  Header,
  Body,
  Footer,
  closeModal,
  onSave,
  endpoint,
  currentEntity,
}: AiAvatarModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [customPrompt, setCustomPrompt] = useState('');
  const [cropperOpen, setCropperOpen] = useState(false);
  const [croppedAvatar, setCroppedAvatar] = useState<string | null>(null);
  const [surpriseMeSelected, setSurpriseMeSelected] = useState(true);
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);

  const currentAiAvatar =
    currentEntity?.avatar?.avatarType === 'ai_generated' &&
    currentEntity?.avatar?.avatarUrl
      ? currentEntity
      : null;

  // Combine custom prompt with selected suggestions
  const combinedPrompt = [customPrompt.trim(), ...selectedSuggestions]
    .filter(Boolean)
    .join(', ');
  const canGenerate = combinedPrompt.length > 0 || surpriseMeSelected;

  const {
    mutate: generateAvatar,
    isPending: isGenerating,
    data: generatedAvatar,
  } = useMutation<AvatarUser & {ai_prompt_used?: string}, RequestError, string>({
    mutationFn: (ai_prompt: string) => {
      return fetchMutation({
        url: endpoint,
        method: 'PUT',
        data: {
          avatar_type: 'ai_generated',
          ai_prompt,
        },
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Avatar generated successfully!'));
    },
    onError: () => {
      addErrorMessage(t('Failed to generate avatar'));
    },
  });

  useEffect(() => {
    if (!isGenerating) {
      return undefined;
    }

    const interval = setInterval(() => {
      setCurrentImageIndex(prev => (prev + 1) % FUNNY_GENERATION_IMAGES.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [isGenerating]);

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">{t('AI Avatar Generator')}</Heading>
      </Header>

      <Body>
        <ContentGrid>
          <AvatarSection>
            <AvatarContainer>
              <AvatarPreviewArea>
                {isGenerating ? (
                  <LoadingContent>
                    <LoadingPlaceholder>
                      <LoadingBackgroundImage
                        src={FUNNY_GENERATION_IMAGES[currentImageIndex]}
                        alt={t('Loading background')}
                      />
                      <LoadingIndicator size={36} />
                    </LoadingPlaceholder>
                    <GeneratingText>
                      {LOADING_MESSAGES[currentImageIndex % LOADING_MESSAGES.length]}
                    </GeneratingText>
                  </LoadingContent>
                ) : generatedAvatar?.avatar?.avatarUrl ? (
                  <CropperHovercard
                    skipWrapper
                    position="right-end"
                    forceVisible={cropperOpen}
                    body={
                      <CropperContainer>
                        <AvatarCropper
                          minDimension={MIN_DIMENSION}
                          maxDimension={MAX_DIMENSION}
                          dataUrl={croppedAvatar || generatedAvatar.avatar.avatarUrl}
                          updateDataUrlState={dataUrl => {
                            setCroppedAvatar(dataUrl ?? null);
                          }}
                        />
                        <CropperActions>
                          <Button
                            size="xs"
                            priority="danger"
                            onClick={() => {
                              setCropperOpen(false);
                              setCroppedAvatar(null);
                            }}
                          >
                            {t('Cancel')}
                          </Button>
                          <Button
                            size="xs"
                            priority="primary"
                            onClick={() => {
                              setCropperOpen(false);
                            }}
                          >
                            {t('Looks good')}
                          </Button>
                        </CropperActions>
                      </CropperContainer>
                    }
                  >
                    <GeneratedAvatarImage
                      src={croppedAvatar || generatedAvatar.avatar.avatarUrl}
                      alt={t('Generated avatar')}
                    />
                    <CropButton
                      size="xs"
                      className="crop-button"
                      onClick={() => setCropperOpen(true)}
                      aria-label={t('Crop avatar')}
                    >
                      <IconEdit size="xs" />
                    </CropButton>
                  </CropperHovercard>
                ) : currentAiAvatar ? (
                  <CropperHovercard
                    skipWrapper
                    position="right-end"
                    forceVisible={cropperOpen}
                    body={
                      <CropperContainer>
                        <AvatarCropper
                          minDimension={MIN_DIMENSION}
                          maxDimension={MAX_DIMENSION}
                          dataUrl={
                            croppedAvatar ||
                            currentAiAvatar.avatar?.avatarUrl ||
                            undefined
                          }
                          updateDataUrlState={dataUrl => {
                            setCroppedAvatar(dataUrl ?? null);
                          }}
                        />
                        <CropperActions>
                          <Button
                            size="xs"
                            priority="danger"
                            onClick={() => {
                              setCropperOpen(false);
                              setCroppedAvatar(null);
                            }}
                          >
                            {t('Cancel')}
                          </Button>
                          <Button
                            size="xs"
                            priority="primary"
                            onClick={() => {
                              setCropperOpen(false);
                            }}
                          >
                            {t('Looks good')}
                          </Button>
                        </CropperActions>
                      </CropperContainer>
                    }
                  >
                    <GeneratedAvatarImage
                      src={
                        croppedAvatar || currentAiAvatar.avatar?.avatarUrl || undefined
                      }
                      alt={t('Current AI avatar')}
                    />
                    <CropButton
                      size="xs"
                      className="crop-button"
                      onClick={() => setCropperOpen(true)}
                      aria-label={t('Crop avatar')}
                    >
                      <IconEdit size="xs" />
                    </CropButton>
                  </CropperHovercard>
                ) : (
                  <EmptyContent>
                    <AvatarChooserPlaceholder>
                      <IconImage size="xl" />
                    </AvatarChooserPlaceholder>
                    <PlaceholderText>
                      {t('Your epic avatar will spawn here!')}
                    </PlaceholderText>
                  </EmptyContent>
                )}
              </AvatarPreviewArea>
              {generatedAvatar?.ai_prompt_used && (
                <GeneratedPromptDisplay>
                  <GeneratedPromptLabel>{t('Generated with:')}</GeneratedPromptLabel>
                  <GeneratedPromptText>
                    {generatedAvatar.ai_prompt_used}
                  </GeneratedPromptText>
                </GeneratedPromptDisplay>
              )}
            </AvatarContainer>
          </AvatarSection>

          <PromptSection>
            <SectionTitle>{t("What's your vibe?")}</SectionTitle>
            <PromptTextArea>
              <InputGroup>
                <InputGroup.TextArea
                  value={customPrompt}
                  onChange={e => {
                    setCustomPrompt(e.target.value);
                    setSurpriseMeSelected(false);
                  }}
                  placeholder={t(
                    'Tell me what kind of avatar represents you\u2026\n\nBe creative! Think superhero, wizard, robot, or whatever speaks to your dev soul'
                  )}
                  rows={8}
                  autosize={false}
                  name="customPrompt"
                  disabled={isGenerating}
                />
              </InputGroup>
            </PromptTextArea>

            <QuickSuggestions>
              <QuickSuggestionButton
                size="xs"
                priority="default"
                className={surpriseMeSelected ? 'selected' : ''}
                onClick={() => {
                  setSurpriseMeSelected(true);
                  setCustomPrompt('');
                  setSelectedSuggestions([]);
                }}
                disabled={isGenerating}
              >
                ✨ {t('Surprise Me')}
              </QuickSuggestionButton>
              {PROMPT_SUGGESTIONS.map((suggestion, index) => {
                const isSelected = selectedSuggestions.includes(suggestion.prompt);
                return (
                  <QuickSuggestionButton
                    key={index}
                    size="xs"
                    priority="default"
                    className={isSelected ? 'selected' : ''}
                    onClick={() => {
                      setSurpriseMeSelected(false);
                      if (isSelected) {
                        setSelectedSuggestions(
                          selectedSuggestions.filter(s => s !== suggestion.prompt)
                        );
                      } else {
                        setSelectedSuggestions([
                          ...selectedSuggestions,
                          suggestion.prompt,
                        ]);
                      }
                    }}
                    disabled={isGenerating}
                  >
                    {suggestion.category}
                  </QuickSuggestionButton>
                );
              })}
            </QuickSuggestions>

            <GenerateSection>
              <Button
                priority="primary"
                onClick={() =>
                  generateAvatar(surpriseMeSelected ? 'surprise me' : combinedPrompt)
                }
                disabled={isGenerating || !canGenerate}
              >
                {isGenerating ? t('Generating\u2026') : t('Generate Avatar')}
              </Button>
            </GenerateSection>
          </PromptSection>
        </ContentGrid>
      </Body>

      <Footer>
        <ButtonBar gap="lg">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            priority="primary"
            disabled={isGenerating || (!generatedAvatar && !currentAiAvatar)}
            onClick={() => {
              const avatarToSave = generatedAvatar || currentAiAvatar;
              if (avatarToSave) {
                const updatedAvatar = {
                  ...avatarToSave,
                  avatar: {
                    ...avatarToSave.avatar,
                    avatarUrl: croppedAvatar || avatarToSave.avatar?.avatarUrl,
                    avatarType: 'ai_generated' as const,
                    avatarUuid: avatarToSave.avatar?.avatarUuid ?? null,
                  },
                  _croppedData: croppedAvatar,
                };
                onSave?.(updatedAvatar);
              }
              closeModal();
            }}
          >
            {t('Use Avatar')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
}

const ContentGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${p => p.theme.space.xl};
  min-height: 400px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const AvatarSection = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const AvatarContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.lg};
  width: 100%;
  min-height: 400px;
`;

const AvatarPreviewArea = styled('div')`
  position: relative;
  width: 100%;
  max-width: 350px;
  height: 300px;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.backgroundSecondary};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  /* Add checkered background when there's an image */
  &:has(img) {
    background-color: #ffffff;
    background-image:
      linear-gradient(45deg, #f7f6f9 25%, rgba(0, 0, 0, 0) 25%),
      linear-gradient(-45deg, #f7f6f9 25%, rgba(0, 0, 0, 0) 25%),
      linear-gradient(45deg, rgba(0, 0, 0, 0) 75%, #f7f6f9 75%),
      linear-gradient(-45deg, rgba(0, 0, 0, 0) 75%, #f7f6f9 75%);
    background-size: 20px 20px;
    background-position:
      0 0,
      0 10px,
      10px -10px,
      -10px 0px;
  }

  &:hover .crop-button {
    opacity: 1;
    transform: translateY(0);
  }
`;

const LoadingContent = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${p => p.theme.space.md};
`;

const EmptyContent = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${p => p.theme.space.md};
`;

const GeneratedAvatarImage = styled('img')`
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  position: relative;
  z-index: 1;
`;

const CropButton = styled(Button)`
  position: absolute;
  bottom: 12px;
  right: 12px;
  opacity: 0;
  transform: translateY(8px);
  transition: all 0.2s ease-in-out;
  background: ${p => p.theme.backgroundElevated};
  border: 1px solid ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowMedium};
  z-index: 2;

  &.crop-button {
    /* This class is used for the hover selector */
  }
`;

const AvatarChooserPlaceholder = styled('div')`
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.gray200};
  background: ${p => p.theme.backgroundSecondary};
  height: 160px;
  width: 160px;
  border: 2px dashed ${p => p.theme.border};
`;

const PromptSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
`;

const SectionTitle = styled('h5')`
  margin: 0;
  color: ${p => p.theme.textColor};
  font-size: 16px;
  font-weight: 600;
`;

// Prompt Components
const PromptTextArea = styled('div')`
  margin-bottom: ${p => p.theme.space.lg};

  textarea {
    min-height: 160px;
    height: 160px;
    resize: none;
  }
`;

const QuickSuggestions = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${p => p.theme.space.xs};
  margin-top: ${p => p.theme.space.md};
`;

const QuickSuggestionButton = styled(Button)`
  font-size: 12px;
  height: auto;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};

  &.selected {
    background: ${p => p.theme.purple100};
    border-color: ${p => p.theme.purple200};
    color: ${p => p.theme.purple400};
    font-weight: 600;
  }
`;

const GenerateSection = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-top: ${p => p.theme.space.lg};
`;

const PlaceholderText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: 14px;
  text-align: center;
  margin-top: ${p => p.theme.space.md};
`;

const LoadingPlaceholder = styled('div')`
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${p => p.theme.backgroundSecondary};
  height: 160px;
  width: 160px;
  border: 2px solid ${p => p.theme.border};
  position: relative;
  overflow: hidden;
`;

const LoadingBackgroundImage = styled('img')`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.3;
  animation: fadeInOut 0.8s ease-in-out;

  @keyframes fadeInOut {
    0% {
      opacity: 0;
      transform: scale(0.9);
    }
    100% {
      opacity: 0.3;
      transform: scale(1);
    }
  }
`;

const GeneratingText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: 14px;
  text-align: center;
  margin-top: ${p => p.theme.space.md};
`;

const CropperHovercard = styled(Hovercard)``;

const CropperContainer = styled('div')`
  padding: ${p => p.theme.space.md};
  background: ${p => p.theme.backgroundElevated};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowHeavy};
`;

const CropperActions = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-top: ${p => p.theme.space.sm};
  gap: ${p => p.theme.space.sm};
`;

const GeneratedPromptDisplay = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.md};
  margin-top: ${p => p.theme.space.md};
  max-width: 350px;
`;

const GeneratedPromptLabel = styled('div')`
  font-size: 12px;
  font-weight: 600;
  color: ${p => p.theme.purple400};
  margin-bottom: ${p => p.theme.space.xs};
`;

const GeneratedPromptText = styled('div')`
  font-size: 13px;
  color: ${p => p.theme.textColor};
  line-height: 1.4;
  font-style: italic;
  max-height: 80px;
  overflow-y: auto;
  word-wrap: break-word;
`;
