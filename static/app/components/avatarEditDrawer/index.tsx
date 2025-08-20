import React, {useState} from 'react';
import styled from '@emotion/styled';

import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {Text} from 'sentry/components/core/text';
import {TextArea} from 'sentry/components/core/textarea';
import {DrawerComponents} from 'sentry/components/globalDrawer/components';
import {IconDelete, IconImage, IconStar, IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {AvatarUser} from 'sentry/types/user';

interface AvatarEditDrawerProps {
  onClose: () => void;
  onSave: (avatarType: string, avatarData?: any) => void;
  user: AvatarUser;
}

type AvatarMode = 'initials' | 'upload' | 'ai';
type AvatarVariation = {
  description: string;
  filter: string;
  id: string;
  name: string;
  backgroundImage?: string;
};

export function AvatarEditDrawer({user, onClose, onSave}: AvatarEditDrawerProps) {
  const [selectedMode, setSelectedMode] = useState<AvatarMode>('initials');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [selectedInitialsColor, setSelectedInitialsColor] = useState<string>('original');
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [selectedEnhancements, setSelectedEnhancements] = useState<string[]>([
    'surprise',
  ]);

  // AI Enhancement Options
  const enhancementOptions = [
    {
      id: 'surprise',
      label: t('🎲 Surprise Me'),
      description: t('Let AI choose the perfect style for you'),
    },
    {
      id: 'professional',
      label: t('Professional'),
      description: t('Business attire, formal setting'),
    },
    {id: 'nature', label: t('Nature'), description: t('Outdoor, natural background')},
    {id: 'scifi', label: t('Sci-Fi'), description: t('Futuristic, cyberpunk style')},
    {id: 'holiday', label: t('Holiday'), description: t('Festive, seasonal theme')},
    {id: 'artistic', label: t('Artistic'), description: t('Creative, painterly style')},
    {id: 'vintage', label: t('Vintage'), description: t('Retro, classic aesthetic')},
    {id: 'minimalist', label: t('Minimalist'), description: t('Clean, simple design')},
    {id: 'colorful', label: t('Colorful'), description: t('Vibrant, bright colors')},
  ];

  // Distinct Sentry Theme Colors for Initials
  const initialsColors = [
    // Primary colors (distinct shades)
    '#6C5FC7', // purple (Sentry primary)
    '#3C74DD', // blue
    '#2BA185', // green
    '#F55459', // red
    '#F14499', // pink
    '#EBC000', // yellow

    // Secondary variations
    '#2562D4', // darker blue
    '#207964', // darker green
    '#CF2126', // darker red
    '#D1056B', // darker pink
    '#856C00', // darker yellow
    '#ec5e44', // orange

    // Additional distinct colors
    '#57be8c', // classic sentry green
    '#f868bc', // classic sentry pink
    '#3b6ecc', // classic sentry blue

    // Neutrals
    '#71637E', // medium gray
    '#2B2233', // dark gray
    '#1D1127', // black
    '#F0ECF3', // light gray
  ];

  // Background Variations (using your actual background images)
  const backgroundVariations: AvatarVariation[] = [
    {
      id: 'original',
      name: t('Original'),
      description: t('No background'),
      filter: 'none',
    },
    // Beach backgrounds with warm filters
    {
      id: 'beach1',
      name: t('Tropical'),
      description: t('Warm tropical vibes'),
      filter: 'saturate(120%) brightness(110%) hue-rotate(10deg)',
      backgroundImage: '/static/images/avatars/background/beach1.jpg',
    },
    {
      id: 'beach2',
      name: t('Sunset'),
      description: t('Golden hour magic'),
      filter: 'saturate(130%) brightness(115%) hue-rotate(20deg)',
      backgroundImage: '/static/images/avatars/background/beach2.jpg',
    },
    {
      id: 'beach3',
      name: t('Ocean'),
      description: t('Cool ocean breeze'),
      filter: 'saturate(110%) brightness(105%) hue-rotate(-10deg)',
      backgroundImage: '/static/images/avatars/background/beach3.jpg',
    },
    {
      id: 'beach4',
      name: t('Paradise'),
      description: t('Island paradise'),
      filter: 'saturate(125%) brightness(112%) hue-rotate(15deg)',
      backgroundImage: '/static/images/avatars/background/beach4.jpg',
    },
    {
      id: 'beach5',
      name: t('Coastal'),
      description: t('Coastal serenity'),
      filter: 'saturate(115%) brightness(108%) hue-rotate(5deg)',
      backgroundImage: '/static/images/avatars/background/beach5.jpg',
    },
    {
      id: 'beach6',
      name: t('Seaside'),
      description: t('Seaside dreams'),
      filter: 'saturate(125%) brightness(110%) hue-rotate(12deg)',
      backgroundImage: '/static/images/avatars/background/beach6.jpg',
    },
    // Bokeh backgrounds with dreamy filters
    {
      id: 'bokeh1',
      name: t('Dreamy'),
      description: t('Soft dreamy glow'),
      filter: 'saturate(110%) brightness(108%) blur(0.3px)',
      backgroundImage: '/static/images/avatars/background/bokeh1.jpg',
    },
    {
      id: 'bokeh2',
      name: t('Urban'),
      description: t('City night vibes'),
      filter: 'saturate(120%) brightness(105%) hue-rotate(15deg)',
      backgroundImage: '/static/images/avatars/background/bokeh2.jpg',
    },
    {
      id: 'bokeh3',
      name: t('Electric'),
      description: t('Neon electric feel'),
      filter: 'saturate(140%) brightness(110%) hue-rotate(270deg)',
      backgroundImage: '/static/images/avatars/background/bokeh3.jpg',
    },
    // Special effects
    {
      id: 'glow3',
      name: t('Cosmic'),
      description: t('Ethereal cosmic glow'),
      filter: 'saturate(130%) brightness(115%) hue-rotate(180deg)',
      backgroundImage: '/static/images/avatars/background/glow3.jpg',
    },
    {
      id: 'office2',
      name: t('Professional'),
      description: t('Clean office setting'),
      filter: 'saturate(95%) brightness(102%) contrast(105%)',
      backgroundImage: '/static/images/avatars/background/office2.jpg',
    },
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      // Don't force switch to upload mode - let user stay on current tab
      if (selectedMode === 'upload') {
        setSelectedVariation('original');
      }
    }
  };

  const handleRemovePhoto = () => {
    setUploadedFile(null);
    setPreviewUrl(null);
    setSelectedVariation(null);
    setSelectedMode('initials');
  };

  const handleSave = () => {
    // If there's an uploaded photo and we're in upload mode with a variation selected, use that
    if (selectedMode === 'upload' && uploadedFile && selectedVariation) {
      onSave('upload', {file: uploadedFile, variation: selectedVariation});
    }
    // If there's an uploaded photo but no variation, use original
    else if (selectedMode === 'upload' && uploadedFile) {
      onSave('upload', uploadedFile);
    }
    // If in initials mode
    else if (selectedMode === 'initials') {
      if (selectedInitialsColor === 'original') {
        onSave('letter_avatar');
      } else {
        onSave('letter_avatar', {backgroundColor: selectedInitialsColor});
      }
    }
    // AI mode or fallback
    else {
      onSave('letter_avatar');
    }
    onClose();
  };

  const renderAvatarPreview = () => {
    // eslint-disable-next-line no-console
    console.log('Preview state:', {
      selectedMode,
      selectedInitialsColor,
      selectedVariation,
    });

    if (selectedMode === 'initials') {
      if (selectedInitialsColor === 'original') {
        return <UserAvatar user={user} size={150} />;
      }
      return (
        <TopAvatarWrapper backgroundColor={selectedInitialsColor}>
          <UserAvatar user={user} size={150} />
        </TopAvatarWrapper>
      );
    }

    if (selectedMode === 'upload' && previewUrl && selectedVariation) {
      const variation = backgroundVariations.find(v => v.id === selectedVariation);

      if (variation?.backgroundImage) {
        return (
          <AvatarWithBackground backgroundImage={variation.backgroundImage} size={150}>
            <PreviewAvatar
              src={previewUrl}
              alt="Avatar preview"
              style={{filter: variation?.filter || 'none'}}
            />
          </AvatarWithBackground>
        );
      }

      return (
        <PreviewAvatar
          src={previewUrl}
          alt="Avatar preview"
          style={{filter: variation?.filter || 'none'}}
        />
      );
    }

    if (selectedMode === 'upload' && previewUrl) {
      return <PreviewAvatar src={previewUrl} alt="Avatar preview" />;
    }

    if (selectedMode === 'upload') {
      return (
        <BlankAvatar>
          <IconImage size="xl" />
        </BlankAvatar>
      );
    }

    if (selectedMode === 'ai') {
      return (
        <BlankAvatar>
          <IconStar size="xl" />
        </BlankAvatar>
      );
    }

    return <UserAvatar user={user} size={150} />;
  };

  const renderModeContent = () => {
    switch (selectedMode) {
      case 'initials':
        return (
          <InitialsSection>
            <ColorGrid>
              {/* Original Avatar Option */}
              <AvatarOptionWithLabel
                key="original"
                isSelected={selectedInitialsColor === 'original'}
                onClick={() => setSelectedInitialsColor('original')}
              >
                <UserAvatar user={user} size={120} />
                <OptionLabel>{t('Original')}</OptionLabel>
              </AvatarOptionWithLabel>

              {initialsColors.map(color => (
                <AvatarOption
                  key={color}
                  isSelected={selectedInitialsColor === color}
                  onClick={() => setSelectedInitialsColor(color)}
                >
                  <InitialsAvatarWrapper
                    backgroundColor={color}
                    isSelected={selectedInitialsColor === color}
                  >
                    <UserAvatar user={user} size={120} title={`Background: ${color}`} />
                  </InitialsAvatarWrapper>
                </AvatarOption>
              ))}
            </ColorGrid>
          </InitialsSection>
        );

      case 'upload':
        return uploadedFile ? (
          <PhotoVariationsSection>
            <AvatarGrid>
              {/* Upload Another Option */}
              <AvatarOptionWithLabel
                key="upload-another"
                isSelected={false}
                onClick={() => {
                  document.getElementById('avatar-upload-another')?.click();
                }}
              >
                <UploadAnotherButton>
                  <IconUpload size="lg" />
                  <UploadAnotherText>{t('Replace Photo')}</UploadAnotherText>
                </UploadAnotherButton>
              </AvatarOptionWithLabel>

              {backgroundVariations.map((variation, index) => (
                <AvatarOptionWithLabel
                  key={variation.id}
                  isSelected={selectedVariation === variation.id}
                  onClick={() => setSelectedVariation(variation.id)}
                >
                  {variation.backgroundImage ? (
                    <AvatarWithBackground backgroundImage={variation.backgroundImage}>
                      <GridPreviewAvatar
                        src={previewUrl!}
                        alt={variation.name}
                        style={{filter: variation.filter}}
                        title={variation.name}
                      />
                    </AvatarWithBackground>
                  ) : (
                    <GridPreviewAvatar
                      src={previewUrl!}
                      alt={variation.name}
                      style={{filter: variation.filter}}
                      title={variation.name}
                    />
                  )}
                  {index === 0 && <OptionLabel>{t('Original')}</OptionLabel>}
                </AvatarOptionWithLabel>
              ))}
            </AvatarGrid>

            <FileInput
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              id="avatar-upload-another"
            />
          </PhotoVariationsSection>
        ) : (
          <UploadSection>
            <UploadPrompt>
              <FormLabel>{t('Choose Your Photo')}</FormLabel>
              <UploadDescription>
                {t('We support JPG, PNG, and GIF formats')}
              </UploadDescription>
            </UploadPrompt>

            <FileInput
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              id="avatar-upload"
            />
            <FileInputLabel htmlFor="avatar-upload">
              <IconUpload size="lg" />
              <UploadButtonText>{t('Select Photo')}</UploadButtonText>
            </FileInputLabel>
          </UploadSection>
        );

      case 'ai':
        return (
          <AISection>
            <PromptSection>
              <FormLabel>{t('Describe your ideal avatar')}</FormLabel>
              <StyledTextArea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder={t(
                  'e.g., A professional headshot with a warm smile in a modern office setting'
                )}
                rows={5}
                autosize
                maxRows={8}
              />
            </PromptSection>

            <EnhancementsSection>
              <FormLabel>{t('Enhancement Options')}</FormLabel>
              <EnhancementsGrid>
                {enhancementOptions.map(option => (
                  <EnhancementChip
                    key={option.id}
                    isSelected={selectedEnhancements.includes(option.id)}
                    onClick={() => {
                      setSelectedEnhancements(prev =>
                        prev.includes(option.id)
                          ? prev.filter(id => id !== option.id)
                          : [...prev, option.id]
                      );
                    }}
                    title={option.description}
                  >
                    {option.label}
                  </EnhancementChip>
                ))}
              </EnhancementsGrid>
            </EnhancementsSection>

            <GenerateButton
              size="md"
              priority="primary"
              onClick={() => {
                // TODO: Implement AI generation
                const enhancementLabels = selectedEnhancements
                  .map(id => enhancementOptions.find(opt => opt.id === id)?.label)
                  .filter(Boolean);
                const finalPrompt = [aiPrompt, ...enhancementLabels]
                  .filter(Boolean)
                  .join(', ');
                // eslint-disable-next-line no-console
                console.log('Generate AI avatar with prompt:', finalPrompt);
              }}
              disabled={!aiPrompt.trim() && selectedEnhancements.length === 0}
            >
              {t('Generate AI Avatar')}
            </GenerateButton>
          </AISection>
        );

      default:
        return null;
    }
  };

  return (
    <DrawerContainer>
      <DrawerComponents.DrawerHeader>
        <DrawerTitle>{t('Edit Avatar')}</DrawerTitle>
      </DrawerComponents.DrawerHeader>

      <DrawerContent>
        <AvatarSection>{renderAvatarPreview()}</AvatarSection>

        <SegmentedControlSection>
          <FullWidthSegmentedControl
            value={selectedMode}
            onChange={(value: string) => setSelectedMode(value as AvatarMode)}
            size="md"
          >
            <SegmentedControl.Item key="initials">
              {t('Use Name Initials')}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="upload">
              {t('Upload Photo')}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="ai">
              {t('Generate with AI')}
            </SegmentedControl.Item>
          </FullWidthSegmentedControl>
        </SegmentedControlSection>

        <ContentSection>{renderModeContent()}</ContentSection>
      </DrawerContent>

      <DrawerFooter>
        <Button onClick={onClose} priority="default">
          {t('Cancel')}
        </Button>
        <Button onClick={handleSave} priority="primary">
          {t('Save')}
        </Button>
      </DrawerFooter>
    </DrawerContainer>
  );
}

const DrawerContainer = styled('div')`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const DrawerTitle = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  display: flex;
  align-items: center;
  line-height: 1;
`;

const AvatarSection = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(2)};
  margin-bottom: ${space(3)};
  padding: ${space(2)} 0;
`;

const RemovePhotoButton = styled(Button)`
  margin-top: ${space(1)};
`;

const PhotoVariationsSection = styled('div')`
  /* Same styling as initials section */
`;

const UploadAnotherButton = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  border: 2px dashed ${p => p.theme.border};
  border-radius: 50%;
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};
  gap: ${space(1)};
  transition: all 0.2s ease;

  &:hover {
    border-color: ${p => p.theme.purple300};
    background: ${p => p.theme.purple50};
    color: ${p => p.theme.purple300};
  }
`;

const UploadAnotherText = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: ${p => p.theme.fontWeight.medium};
  text-align: center;
`;

const PhotoInfo = styled('div')`
  text-align: center;
  padding: ${space(2)};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  margin-top: ${space(2)};
  font-style: italic;
`;

const SegmentedControlSection = styled('div')`
  margin-bottom: ${space(3)};
  > div {
    width: 100% !important;
  }
`;

const FullWidthSegmentedControl = styled(SegmentedControl)`
  width: 100% !important;
  display: block !important;

  /* Target the specific GroupWrap component */
  .app-11gi19n-GroupWrap-LegacyComponent,
  .GroupWrap-LegacyComponent,
  > div {
    width: 100% !important;
    display: grid !important;
    grid-template-columns: 1fr 1fr 1fr !important;
    min-width: 100% !important;
  }

  /* Force each segment to take equal space */
  [role='radio'] {
    flex: 1 !important;
    min-width: 0 !important;
    width: 100% !important;
  }

  /* Override any inline-grid default */
  & > div[style] {
    display: grid !important;
  }
`;

const ContentSection = styled('div')`
  flex: 1;
  overflow-y: auto;
`;

// Initials Section
const InitialsSection = styled('div')`
  padding: ${space(2)};
`;

const ColorGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${space(2)};
`;

// Upload Section
const UploadSection = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(3)};
  padding: ${space(3)};
`;

const UploadPrompt = styled('div')`
  text-align: center;
  max-width: 300px;
`;

const UploadDescription = styled('p')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  margin: 0;
  line-height: 1.5;
`;

const UploadButtonText = styled('span')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.medium};
`;

const FileInputLabel = styled('label')`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(2)};
  padding: ${space(4)};
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${p => p.theme.backgroundSecondary};
  min-width: 200px;

  &:hover {
    border-color: ${p => p.theme.purple300};
    background: ${p => p.theme.purple100};
  }

  svg {
    color: ${p => p.theme.subText};
  }

  &:hover svg {
    color: ${p => p.theme.purple300};
  }
`;

const UploadAvatarWrapper = styled('div')`
  position: relative;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;

  &:hover {
    .hover-overlay {
      opacity: 1;
    }
  }
`;

const HoverOverlay = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  border-radius: 50%;

  &.hover-overlay {
    /* Class for easier targeting */
  }
`;

const UploadLabel = styled('label')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  gap: ${space(0.5)};

  svg {
    color: white;
  }
`;

const UploadText = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  color: white;
  text-align: center;
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Section = styled('div')`
  margin-bottom: ${space(2)};
`;

const SectionTitle = styled('h4')`
  margin: 0 0 ${space(2)} 0;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.textColor};
`;

const AvatarGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${space(1)};
`;

const AvatarOption = styled('div')<{isSelected: boolean}>`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => (p.isSelected ? p.theme.purple100 : 'transparent')};

  &:hover {
    transform: scale(1.05);
  }
`;

const AvatarOptionWithLabel = styled('div')<{isSelected: boolean}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => (p.isSelected ? p.theme.purple100 : 'transparent')};
  gap: ${space(0.5)};

  &:hover {
    transform: scale(1.05);
  }
`;

const OptionLabel = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.textColor};
  font-weight: ${p => p.theme.fontWeight.medium};
  text-align: center;
`;

const GridPreviewAvatar = styled('img')`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: none;
  position: relative;
  z-index: 1;
`;

const TopAvatarWrapper = styled('div')<{backgroundColor: string}>`
  /* Target the SVG fill for top avatar */
  svg rect {
    fill: ${p => p.backgroundColor} !important;
  }
`;

const BlankAvatar = styled('div')`
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.gray200};
  background: ${p => p.theme.backgroundSecondary};
  height: 150px;
  width: 150px;
  border: 2px dashed ${p => p.theme.border};
`;

const InitialsAvatarWrapper = styled('div')<{
  backgroundColor: string;
  isSelected: boolean;
}>`
  span {
    border: none !important;
  }

  /* Target the SVG fill for letter avatars - override the default colors */
  svg rect {
    fill: ${p => p.backgroundColor} !important;
  }
`;

const AvatarWithBackground = styled('div')<{backgroundImage?: string; size?: number}>`
  position: relative;
  width: ${p => p.size || 120}px;
  height: ${p => p.size || 120}px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  box-sizing: border-box;

  /* Mask image overlay */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: ${p => (p.backgroundImage ? `url(${p.backgroundImage})` : 'none')};
    background-size: cover;
    background-position: center;
    mix-blend-mode: overlay;
    opacity: 0.6;
    border-radius: 50%;
    z-index: 2;
  }
`;

const PreviewAvatar = styled('img')`
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
  border: none;
  position: relative;
  z-index: 1;
`;

const RemoveSection = styled('div')`
  display: flex;
  justify-content: center;
  margin-top: ${space(3)};
`;

const FormLabel = styled('label')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: 600;
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(1)};
`;

const AISection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

const PromptSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const StyledTextArea = styled(TextArea)`
  min-height: 120px;
`;

const EnhancementsSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const EnhancementsGrid = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
`;

const EnhancementChip = styled('div')<{isSelected: boolean}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: ${space(1)} ${space(2)};
  border: 1px solid ${p => (p.isSelected ? p.theme.purple300 : p.theme.border)};
  border-radius: 12px;
  background: ${p => (p.isSelected ? p.theme.purple100 : p.theme.backgroundSecondary)};
  color: ${p => (p.isSelected ? p.theme.purple400 : p.theme.textColor)};
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.medium};
  text-align: center;
  white-space: nowrap;

  &:hover {
    border-color: ${p => p.theme.purple300};
    background: ${p => (p.isSelected ? p.theme.purple100 : p.theme.backgroundTertiary)};
    color: ${p => p.theme.purple400};
  }
`;

const GenerateButton = styled(Button)`
  align-self: flex-start;
  margin-top: ${space(2)};
`;

const DrawerContent = styled('div')`
  flex: 1;
  padding: ${space(3)};
  overflow-y: auto;
`;

const FileInput = styled('input')`
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  position: absolute !important;
  left: -9999px !important;
`;

const DrawerFooter = styled('div')`
  display: flex;
  justify-content: flex-end;
  gap: ${space(1)};
  padding: ${space(3)};
  border-top: 1px solid ${p => p.theme.border};
`;
