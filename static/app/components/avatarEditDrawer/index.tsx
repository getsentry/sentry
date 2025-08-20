import React, {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import pattern3 from 'sentry-images/avatar/backgrounds/2c3697fa92394a6a947d7feb4a289c28.svg';
import pattern4 from 'sentry-images/avatar/backgrounds/4ccd496e599c400bb6f35fe7f32c8615.svg';
import pattern10 from 'sentry-images/avatar/backgrounds/8b0d7434d30146a48504ad537384455a.svg';
import pattern6 from 'sentry-images/avatar/backgrounds/58f18c6c9308411fae945a7403875f25.svg';
import pattern7 from 'sentry-images/avatar/backgrounds/60ac4100f46048579927b9656ecfc1d3.svg';
import pattern5 from 'sentry-images/avatar/backgrounds/569e694972e14e01a16a500a6374593a.svg';
import pattern8 from 'sentry-images/avatar/backgrounds/694c2270fcf54a60bed0099c7c37c39d.svg';
import pattern9 from 'sentry-images/avatar/backgrounds/8217c75fe9d74914ae7510e4c64c1aaf.svg';
// Import all SVG patterns
import pattern1 from 'sentry-images/avatar/backgrounds/093326e15c6c4aa3a43f83ac116572f8.svg';
import pattern2 from 'sentry-images/avatar/backgrounds/185489d7d6aa447ab1283f39b317a395.svg';
import pattern11 from 'sentry-images/avatar/backgrounds/a4c742a840854aa29e2f4c8b22602195.svg';
import pattern12 from 'sentry-images/avatar/backgrounds/b493a83843d6431e9548658eeaf87a52.svg';
// Import background images - JPG photos
import beach1 from 'sentry-images/avatar/backgrounds/beach1.jpg';
import beach2 from 'sentry-images/avatar/backgrounds/beach2.jpg';
import beach3 from 'sentry-images/avatar/backgrounds/beach3.jpg';
import beach4 from 'sentry-images/avatar/backgrounds/beach4.jpg';
import beach5 from 'sentry-images/avatar/backgrounds/beach5.jpg';
import beach6 from 'sentry-images/avatar/backgrounds/beach6.jpg';
import bokeh1 from 'sentry-images/avatar/backgrounds/bokeh1.jpg';
import bokeh2 from 'sentry-images/avatar/backgrounds/bokeh2.jpg';
import bokeh3 from 'sentry-images/avatar/backgrounds/bokeh3.jpg';
import pattern14 from 'sentry-images/avatar/backgrounds/c9343cd82e474c50aad90ec1672af451.svg';
import pattern13 from 'sentry-images/avatar/backgrounds/c500607b00aa49219ea93bb96c18a86f.svg';
// Import seasonal themed images
import christmas1 from 'sentry-images/avatar/backgrounds/christmas-1.png';
import christmas2 from 'sentry-images/avatar/backgrounds/christmas-2.png';
import christmas4 from 'sentry-images/avatar/backgrounds/christmas-4.png';
import pattern15 from 'sentry-images/avatar/backgrounds/dcc88431a3184faf96eb903b20d75b0e.svg';
import glow3 from 'sentry-images/avatar/backgrounds/glow3.jpg';
import halloween2 from 'sentry-images/avatar/backgrounds/halloween-2.jpg';
import halloween from 'sentry-images/avatar/backgrounds/halloween.jpg';
import office2 from 'sentry-images/avatar/backgrounds/office2.jpg';

import {updateUser} from 'sentry/actionCreators/account';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {TextArea} from 'sentry/components/core/textarea';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DrawerComponents} from 'sentry/components/globalDrawer/components';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconImage, IconStar, IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {AvatarUser} from 'sentry/types/user';
import {saveUserAvatarVariation} from 'sentry/utils/avatarWithBackground';
import useApi from 'sentry/utils/useApi';

interface AvatarEditDrawerProps {
  onClose: () => void;
  onSave: (avatarType: string, avatarData?: any) => void;
  user: AvatarUser;
  endpoint?: string;
}

type AvatarMode = 'initials' | 'upload' | 'ai';
type AvatarVariation = {
  description: string;
  filter: string;
  id: string;
  name: string;
  backgroundImage?: string;
  patternColor?: string;
};

export function AvatarEditDrawer({
  user,
  onClose,
  onSave,
  endpoint = '/users/me/avatar/',
}: AvatarEditDrawerProps) {
  const api = useApi();

  const generateAIAvatar = async () => {
    if (isGenerating) return;

    console.log('🤖 generateAIAvatar called explicitly');
    console.log('🤖 Current prompt:', aiPrompt);
    console.log('🤖 Current enhancements:', selectedEnhancements);

    setIsGenerating(true);

    try {
      const enhancementLabels = selectedEnhancements
        .map(id => enhancementOptions.find(opt => opt.id === id)?.label)
        .filter(Boolean);
      const finalPrompt = [aiPrompt, ...enhancementLabels].filter(Boolean).join(', ');

      if (!finalPrompt.trim()) {
        console.log('🤖 No prompt provided, aborting generation');
        addErrorMessage(t('Please enter a prompt to generate an avatar'));
        setIsGenerating(false);
        return;
      }

      console.log('🤖 Generating AI avatar with prompt:', finalPrompt);

      const response = await api.requestPromise(`/users/me/avatar/`, {
        method: 'PUT',
        data: {
          avatar_type: 'ai_generated',
          ai_prompt: finalPrompt,
        },
      });

      console.log('🤖 AI generation response (full):', JSON.stringify(response, null, 2));
      console.log('🤖 AI generation response.avatarUrl:', response.avatarUrl);
      console.log('🤖 AI generation response.avatar:', response.avatar);
      console.log(
        '🤖 AI generation response.avatar?.avatarUrl:',
        response.avatar?.avatarUrl
      );

      if (response.avatar?.avatarUrl) {
        // Convert relative URL to full localhost URL
        let avatarUrl = response.avatar.avatarUrl;
        if (avatarUrl.startsWith('/avatar/')) {
          avatarUrl = `http://localhost:8000${avatarUrl}`;
        }

        console.log('🤖 Setting generated avatar URL:', avatarUrl);
        console.log('🤖 Original response avatar.avatarUrl:', response.avatar.avatarUrl);

        setGeneratedAvatarUrl(avatarUrl);
        setUsedPrompt(response.ai_prompt_used || finalPrompt);
        addSuccessMessage(t('AI avatar generated successfully!'));
      } else {
        console.log('🤖 No avatarUrl in response.avatar:', response.avatar);
        console.log('🤖 Full response structure:', JSON.stringify(response, null, 2));
        addErrorMessage(t('No avatar URL returned from generation'));
      }
    } catch (error) {
      console.error('🤖 AI generation failed:', error);
      addErrorMessage(t('Failed to generate AI avatar. Please try again.'));
    } finally {
      setIsGenerating(false);
    }
  };
  // Determine initial mode based on current avatar type
  const getInitialMode = (): AvatarMode => {
    if (user.avatar?.avatarType === 'upload') {
      return 'upload';
    }
    if (user.avatar?.avatarType === ('ai_generated' as any)) {
      return 'ai';
    }
    return 'initials';
  };

  // Initialize with existing avatar if available
  const getInitialPreviewUrl = () => {
    if (user.avatar?.avatarType === 'upload') {
      let avatarUrl = user.avatar?.avatarUrl || null;
      // Fix hostname mismatch for existing avatars
      if (avatarUrl && avatarUrl.includes('dev.getsentry.net:8000')) {
        avatarUrl = avatarUrl.replace('dev.getsentry.net:8000', 'localhost:8000');
      }
      return avatarUrl;
    }
    return null;
  };

  const [selectedMode, setSelectedMode] = useState<AvatarMode>(getInitialMode());
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(getInitialPreviewUrl());

  const getInitialVariation = () => {
    // Always try to get the user's saved variation, regardless of avatar type
    const savedVariation = localStorage.getItem(`avatar-variation-${user.id}`);
    if (savedVariation) {
      console.log('🏁 Found saved variation for user:', savedVariation);
      return savedVariation;
    }
    console.log('🏁 Initializing selectedVariation to: original (no saved variation)');
    return 'original';
  };

  const getInitialInitialsColor = () => {
    // If there's a saved color variation, extract the color name
    const savedVariation = localStorage.getItem(`avatar-variation-${user.id}`);
    if (savedVariation && savedVariation.startsWith('color-')) {
      const colorName = savedVariation.replace('color-', '');
      // Map color names back to hex codes for the drawer
      const colorNameToHex: Record<string, string> = {
        purple: '#6C5FC7',
        blue: '#3C74DD',
        green: '#2BA185',
        red: '#F55459',
        pink: '#F14499',
        yellow: '#EBC000',
      };
      const hexColor = colorNameToHex[colorName];
      console.log('🏁 Found saved initials color:', colorName, '→', hexColor);
      return hexColor || 'original';
    }
    console.log('🏁 Initializing selectedInitialsColor to: original');
    return 'original';
  };

  const [selectedVariation, setSelectedVariation] = useState<string | null>(
    getInitialVariation()
  );

  const [selectedInitialsColor, setSelectedInitialsColor] = useState<string>(
    getInitialInitialsColor()
  );
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [selectedEnhancements, setSelectedEnhancements] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Debug when isGenerating changes
  useEffect(() => {
    console.log('🤖 isGenerating changed to:', isGenerating);
    if (isGenerating) {
      console.trace('🤖 Stack trace for isGenerating=true');
    }
  }, [isGenerating]);

  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string | null>(() => {
    // Initialize with existing AI avatar if user has one
    if (user.avatar?.avatarType === ('ai_generated' as any) && user.avatar?.avatarUrl) {
      let avatarUrl = user.avatar.avatarUrl;

      // Convert relative URL to full URL
      if (avatarUrl.startsWith('/avatar/')) {
        avatarUrl = `http://localhost:8000${avatarUrl}`;
      }

      // Fix hostname mismatch
      if (avatarUrl.includes('dev.getsentry.net:8000')) {
        avatarUrl = avatarUrl.replace('dev.getsentry.net:8000', 'localhost:8000');
      }

      console.log('🤖 Initializing with existing AI avatar:', avatarUrl);
      return avatarUrl;
    }

    console.log('🤖 Starting with no generated avatar');
    return null;
  });
  const [usedPrompt, setUsedPrompt] = useState<string | null>(null);

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

  // Background Variations (using imported background images)
  const backgroundVariations: AvatarVariation[] = [
    {
      id: 'original',
      name: t('Original'),
      description: t('No effects'),
      filter: 'none',
    },
    // Solid color backgrounds (matching initials colors)
    {
      id: 'color-purple',
      name: t('Sentry Purple'),
      description: t('Classic Sentry brand color'),
      filter: 'none',
      backgroundImage: '#6C5FC7',
    },
    {
      id: 'color-blue',
      name: t('Sentry Blue'),
      description: t('Professional blue tone'),
      filter: 'none',
      backgroundImage: '#3C74DD',
    },
    {
      id: 'color-green',
      name: t('Sentry Green'),
      description: t('Fresh green accent'),
      filter: 'none',
      backgroundImage: '#2BA185',
    },
    {
      id: 'color-red',
      name: t('Sentry Red'),
      description: t('Bold red statement'),
      filter: 'none',
      backgroundImage: '#F55459',
    },
    {
      id: 'color-pink',
      name: t('Sentry Pink'),
      description: t('Vibrant pink energy'),
      filter: 'none',
      backgroundImage: '#F14499',
    },
    {
      id: 'color-yellow',
      name: t('Sentry Yellow'),
      description: t('Bright yellow highlight'),
      filter: 'none',
      backgroundImage: '#EBC000',
    },
    // Beach backgrounds with warm filters
    {
      id: 'beach1',
      name: t('Tropical'),
      description: t('Warm tropical vibes'),
      filter: 'saturate(120%) brightness(110%) hue-rotate(10deg)',
      backgroundImage: beach1,
    },
    {
      id: 'beach2',
      name: t('Sunset'),
      description: t('Golden hour magic'),
      filter: 'saturate(130%) brightness(115%) hue-rotate(20deg)',
      backgroundImage: beach2,
    },
    {
      id: 'beach3',
      name: t('Ocean'),
      description: t('Cool ocean breeze'),
      filter: 'saturate(110%) brightness(105%) hue-rotate(-10deg)',
      backgroundImage: beach3,
    },
    {
      id: 'beach4',
      name: t('Paradise'),
      description: t('Island paradise'),
      filter: 'saturate(125%) brightness(112%) hue-rotate(15deg)',
      backgroundImage: beach4,
    },
    {
      id: 'beach5',
      name: t('Coastal'),
      description: t('Coastal serenity'),
      filter: 'saturate(115%) brightness(108%) hue-rotate(5deg)',
      backgroundImage: beach5,
    },
    {
      id: 'beach6',
      name: t('Seaside'),
      description: t('Seaside dreams'),
      filter: 'saturate(125%) brightness(110%) hue-rotate(12deg)',
      backgroundImage: beach6,
    },
    // Bokeh backgrounds with dreamy filters
    {
      id: 'bokeh1',
      name: t('Dreamy'),
      description: t('Soft dreamy glow'),
      filter: 'saturate(110%) brightness(108%) blur(0.3px)',
      backgroundImage: bokeh1,
    },
    {
      id: 'bokeh2',
      name: t('Urban'),
      description: t('City night vibes'),
      filter: 'saturate(120%) brightness(105%) hue-rotate(15deg)',
      backgroundImage: bokeh2,
    },
    {
      id: 'bokeh3',
      name: t('Electric'),
      description: t('Neon electric feel'),
      filter: 'saturate(140%) brightness(110%) hue-rotate(270deg)',
      backgroundImage: bokeh3,
    },
    // Special effects
    {
      id: 'glow3',
      name: t('Cosmic'),
      description: t('Ethereal cosmic glow'),
      filter: 'saturate(130%) brightness(115%) hue-rotate(180deg)',
      backgroundImage: glow3,
    },
    {
      id: 'office2',
      name: t('Professional'),
      description: t('Clean office setting'),
      filter: 'saturate(95%) brightness(102%) contrast(105%)',
      backgroundImage: office2,
    },
    // SVG pattern backgrounds (each pattern with different Sentry brand color)
    {
      id: 'pattern1-purple',
      name: t('Purple Geometric'),
      description: t('Geometric pattern in Sentry purple'),
      filter: 'none',
      backgroundImage: pattern1,
      patternColor: '#6C5FC7', // Sentry purple
    },
    {
      id: 'pattern2-red',
      name: t('Red Abstract'),
      description: t('Abstract pattern in Sentry red'),
      filter: 'none',
      backgroundImage: pattern2,
      patternColor: '#F55459', // Sentry red
    },
    {
      id: 'pattern3-yellow',
      name: t('Yellow Waves'),
      description: t('Wave pattern in Sentry yellow'),
      filter: 'none',
      backgroundImage: pattern3,
      patternColor: '#EBC000', // Sentry yellow
    },
    {
      id: 'pattern4-blue',
      name: t('Blue Dynamic'),
      description: t('Dynamic pattern in Sentry blue'),
      filter: 'none',
      backgroundImage: pattern4,
      patternColor: '#3C74DD', // Sentry blue
    },
    {
      id: 'pattern5-green',
      name: t('Green Elegant'),
      description: t('Elegant pattern in Sentry green'),
      filter: 'none',
      backgroundImage: pattern5,
      patternColor: '#2BA185', // Sentry green
    },
    {
      id: 'pattern6-orange',
      name: t('Orange Flow'),
      description: t('Flowing pattern in Sentry orange'),
      filter: 'none',
      backgroundImage: pattern6,
      patternColor: '#ec5e44', // Sentry orange
    },
    {
      id: 'pattern7-pink',
      name: t('Pink Curves'),
      description: t('Curved pattern in Sentry pink'),
      filter: 'none',
      backgroundImage: pattern7,
      patternColor: '#F14499', // Sentry pink
    },
    {
      id: 'pattern8-teal',
      name: t('Teal Classic'),
      description: t('Classic pattern in teal'),
      filter: 'none',
      backgroundImage: pattern8,
      patternColor: '#57be8c', // Classic green/teal
    },
    {
      id: 'pattern9-navy',
      name: t('Navy Bold'),
      description: t('Bold pattern in navy'),
      filter: 'none',
      backgroundImage: pattern9,
      patternColor: '#2562D4', // Dark blue
    },
    {
      id: 'pattern10-magenta',
      name: t('Magenta Vibrant'),
      description: t('Vibrant pattern in magenta'),
      filter: 'none',
      backgroundImage: pattern10,
      patternColor: '#D1056B', // Dark pink
    },
    {
      id: 'pattern11-forest',
      name: t('Forest Deep'),
      description: t('Deep pattern in forest green'),
      filter: 'none',
      backgroundImage: pattern11,
      patternColor: '#207964', // Dark green
    },
    {
      id: 'pattern12-royal',
      name: t('Royal Pink'),
      description: t('Royal pattern in pink'),
      filter: 'none',
      backgroundImage: pattern12,
      patternColor: '#f868bc', // Classic pink
    },
    {
      id: 'pattern13-sky',
      name: t('Sky Blue'),
      description: t('Sky pattern in blue'),
      filter: 'none',
      backgroundImage: pattern13,
      patternColor: '#3b6ecc', // Classic blue
    },
    {
      id: 'pattern14-charcoal',
      name: t('Charcoal Modern'),
      description: t('Modern pattern in charcoal'),
      filter: 'none',
      backgroundImage: pattern14,
      patternColor: '#2B2233', // Dark gray
    },
    {
      id: 'pattern15-slate',
      name: t('Slate Sophisticated'),
      description: t('Sophisticated pattern in slate'),
      filter: 'none',
      backgroundImage: pattern15,
      patternColor: '#71637E', // Medium gray
    },
    // Seasonal themed backgrounds
    {
      id: 'christmas1',
      name: t('Christmas Magic'),
      description: t('Festive Christmas spirit'),
      filter: 'saturate(120%) brightness(110%) hue-rotate(5deg)',
      backgroundImage: christmas1,
    },
    {
      id: 'christmas2',
      name: t('Holiday Cheer'),
      description: t('Warm holiday atmosphere'),
      filter: 'saturate(115%) brightness(108%) hue-rotate(10deg)',
      backgroundImage: christmas2,
    },
    {
      id: 'christmas4',
      name: t('Winter Wonderland'),
      description: t('Magical winter scene'),
      filter: 'saturate(110%) brightness(105%) hue-rotate(-5deg)',
      backgroundImage: christmas4,
    },
    {
      id: 'halloween',
      name: t('Spooky Halloween'),
      description: t('Mysterious Halloween vibes'),
      filter: 'saturate(130%) brightness(95%) hue-rotate(15deg)',
      backgroundImage: halloween,
    },
    {
      id: 'halloween2',
      name: t('Halloween Night'),
      description: t('Dark Halloween atmosphere'),
      filter: 'saturate(125%) brightness(90%) hue-rotate(20deg)',
      backgroundImage: halloween2,
    },
    // Filter effects (at the end)
    {
      id: 'filter-warm',
      name: t('Warm Filter'),
      description: t('Warm color enhancement'),
      filter: 'saturate(120%) brightness(110%) hue-rotate(10deg)',
      backgroundImage: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    },
    {
      id: 'filter-cool',
      name: t('Cool Filter'),
      description: t('Cool color enhancement'),
      filter: 'saturate(110%) brightness(105%) hue-rotate(-10deg)',
      backgroundImage: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    },
    {
      id: 'filter-vintage',
      name: t('Vintage Filter'),
      description: t('Retro color grading'),
      filter: 'saturate(85%) brightness(108%) sepia(20%) hue-rotate(15deg)',
      backgroundImage: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    },
    {
      id: 'filter-dramatic',
      name: t('Dramatic Filter'),
      description: t('High contrast drama'),
      filter: 'saturate(130%) brightness(95%) contrast(120%)',
      backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
      id: 'filter-bw',
      name: t('Black & White'),
      description: t('Classic monochrome effect'),
      filter: 'grayscale(100%) contrast(110%) brightness(105%)',
    },
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🚨 handleFileUpload called!', event);
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      // Don't force switch to upload mode - let user stay on current tab
      if (selectedMode === 'upload') {
        console.log('🚨 Resetting selectedVariation to original in handleFileUpload');
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

  const handleSave = async () => {
    if (isSaving) return; // Prevent double-clicks

    console.log('🔍 Save button clicked!', {
      selectedMode,
      uploadedFile: !!uploadedFile,
      selectedVariation,
      selectedInitialsColor,
    });

    setIsSaving(true);

    const avatarType = selectedMode === 'initials' ? 'letter_avatar' : 'upload';
    const data: any = {avatar_type: avatarType};

    // Handle uploaded photo with background (new upload)
    if (selectedMode === 'upload' && uploadedFile) {
      console.log('🔍 Branch: New upload with file');
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = (reader.result as string).split(',')[1];
        data.avatar_photo = base64Data;

        // Include variation metadata if selected
        if (selectedVariation && selectedVariation !== 'original') {
          data.variation = selectedVariation;
        }

        api.request(endpoint, {
          method: 'PUT',
          data,
          success: resp => {
            console.log('✅ Upload save response:', resp);
            console.log('🎨 Saving variation for upload:', selectedVariation);

            // Fix avatar URL for proper display
            const updatedResp = {...resp};

            // Handle relative URLs from backend
            if (updatedResp.avatar?.avatarUrl?.startsWith('/avatar/')) {
              updatedResp.avatar.avatarUrl = `http://localhost:8000${updatedResp.avatar.avatarUrl}`;
            }

            // Ensure avatarUrl is at the top level for ConfigStore
            if (updatedResp.avatar?.avatarUrl) {
              updatedResp.avatarUrl = updatedResp.avatar.avatarUrl;
            }

            // Add cache busting to force avatar refresh
            if (updatedResp.avatarUrl) {
              const timestamp = Date.now();
              const random = Math.random().toString(36).substring(7);
              updatedResp.avatarUrl = `${updatedResp.avatarUrl}?v=${timestamp}&r=${random}&bust=1`;
            }

            console.log('📸 Updated upload response for ConfigStore:', updatedResp);

            // Save the variation choice locally
            if (selectedVariation && selectedVariation !== 'original') {
              saveUserAvatarVariation(user.id, selectedVariation);
              console.log('🎨 Saved variation to localStorage:', selectedVariation);
            } else if (selectedVariation === 'original') {
              // Clear any saved variation for original
              localStorage.removeItem(`avatar-variation-${user.id}`);
              console.log('🎨 Cleared variation from localStorage');
            }

            updateUser(updatedResp);
            onSave(avatarType, updatedResp);
            addSuccessMessage(t('Avatar saved successfully!'));
            setIsSaving(false);
            onClose();
          },
          error: resp => {
            const avatarPhotoErrors = resp?.responseJSON?.avatar_photo || [];
            if (avatarPhotoErrors.length) {
              avatarPhotoErrors.forEach(addErrorMessage);
            } else {
              addErrorMessage(t('Failed to save avatar. Please try again.'));
            }
            setIsSaving(false);
          },
        });
      };
      reader.readAsDataURL(uploadedFile);
      return;
    }

    // Handle existing uploaded photo with background change
    if (selectedMode === 'upload' && previewUrl && !uploadedFile) {
      console.log('🔍 Branch: Existing upload with background change');
      console.log('🔍 Saving existing upload with variation:', selectedVariation);

      // Save the variation choice as metadata
      const existingData = {
        avatar_type: 'upload',
        variation: selectedVariation,
      };

      api.request(endpoint, {
        method: 'PUT',
        data: existingData,
        success: resp => {
          console.log('✅ Existing upload save response:', resp);
          console.log('🎨 Saving variation for existing upload:', selectedVariation);

          // Fix avatar URL for proper display (same logic as AI avatars)
          const updatedResp = {...resp};

          // Handle relative URLs from backend
          if (updatedResp.avatar?.avatarUrl?.startsWith('/avatar/')) {
            updatedResp.avatar.avatarUrl = `http://localhost:8000${updatedResp.avatar.avatarUrl}`;
          }

          // Ensure avatarUrl is at the top level for ConfigStore
          if (updatedResp.avatar?.avatarUrl) {
            updatedResp.avatarUrl = updatedResp.avatar.avatarUrl;
          }

          // Add cache busting to force avatar refresh
          if (updatedResp.avatarUrl) {
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(7);
            updatedResp.avatarUrl = `${updatedResp.avatarUrl}?v=${timestamp}&r=${random}&bust=1`;
          }

          console.log(
            '📸 Updated existing upload response for ConfigStore:',
            updatedResp
          );

          // Save the variation choice locally
          if (selectedVariation && selectedVariation !== 'original') {
            saveUserAvatarVariation(user.id, selectedVariation);
            console.log('🎨 Saved variation to localStorage:', selectedVariation);
          } else if (selectedVariation === 'original') {
            // Clear any saved variation for original
            localStorage.removeItem(`avatar-variation-${user.id}`);
            console.log('🎨 Cleared variation from localStorage');
          }

          updateUser(updatedResp);
          onSave(avatarType, updatedResp);
          addSuccessMessage(t('Background preference saved!'));
          setIsSaving(false);
          onClose();
        },
        error: resp => {
          addErrorMessage(t('Failed to save background preference.'));
          setIsSaving(false);
        },
      });
      return;
    }

    // Handle initials with color
    if (selectedMode === 'initials') {
      console.log('🔍 Branch: Initials mode');
      if (selectedInitialsColor !== 'original') {
        data.background_color = selectedInitialsColor;
      }

      api.request(endpoint, {
        method: 'PUT',
        data,
        success: resp => {
          console.log('✅ Initials save response:', resp);

          // Save the color choice locally for initials

          if (selectedInitialsColor && selectedInitialsColor !== 'original') {
            // Map hex codes back to color names
            const hexToColorName: Record<string, string> = {
              '#6C5FC7': 'purple',
              '#3C74DD': 'blue',
              '#2BA185': 'green',
              '#F55459': 'red',
              '#F14499': 'pink',
              '#EBC000': 'yellow',
            };

            const colorName =
              hexToColorName[selectedInitialsColor] || selectedInitialsColor;
            const variationKey = `color-${colorName}`;

            saveUserAvatarVariation(user.id, variationKey);
          } else {
            // Clear any saved variation for original initials

            localStorage.removeItem(`avatar-variation-${user.id}`);
          }

          updateUser(resp);
          onSave(avatarType, resp);
          addSuccessMessage(t('Avatar saved successfully!'));
          setIsSaving(false);
          onClose();
        },
        error: resp => {
          addErrorMessage(t('Failed to save avatar. Please try again.'));
          setIsSaving(false);
        },
      });
    } else if (selectedMode === 'ai' && generatedAvatarUrl) {
      console.log('🔍 Branch: Saving AI generated avatar');
      console.log('🔍 AI save data:', {
        selectedMode,
        generatedAvatarUrl,
        usedPrompt,
        selectedVariation,
      });

      // Save AI avatar as upload to avoid regeneration
      console.log('🤖 Saving AI avatar as upload to prevent regeneration');

      try {
        const response = await fetch(generatedAvatarUrl);
        const blob = await response.blob();
        const reader = new FileReader();

        reader.onload = () => {
          const base64Data = reader.result as string;
          const data = {
            avatar_type: 'upload', // Save as upload to prevent regeneration
            avatar_photo: base64Data,
            variation: selectedVariation,
          };

          console.log('🤖 Saving AI avatar as upload with data:', data);

          api.request(endpoint, {
            method: 'PUT',
            data,
            success: resp => {
              console.log('✅ AI save response:', resp);

              // Fix avatar URL for proper display
              const updatedResp = {...resp};

              // Handle relative URLs from backend
              if (updatedResp.avatar?.avatarUrl?.startsWith('/avatar/')) {
                updatedResp.avatar.avatarUrl = `http://localhost:8000${updatedResp.avatar.avatarUrl}`;
              }

              // Fix hostname mismatch
              if (updatedResp.avatar?.avatarUrl?.includes('dev.getsentry.net:8000')) {
                updatedResp.avatar.avatarUrl = updatedResp.avatar.avatarUrl.replace(
                  'dev.getsentry.net:8000',
                  'localhost:8000'
                );
              }

              // Ensure avatarUrl is at the top level for ConfigStore
              if (updatedResp.avatar?.avatarUrl) {
                updatedResp.avatarUrl = updatedResp.avatar.avatarUrl;
              }

              // Add cache busting to force avatar refresh
              if (updatedResp.avatarUrl) {
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(7);
                updatedResp.avatarUrl = `${updatedResp.avatarUrl}?v=${timestamp}&r=${random}&bust=1`;
              }

              // Keep the response as-is since we're saving as upload type
              // The avatar will be treated as an uploaded image

              console.log('🤖 Updated AI response for ConfigStore:', updatedResp);
              console.log('🤖 Final avatarUrl for navigation:', updatedResp.avatarUrl);
              console.log('🤖 Final avatarType for navigation:', updatedResp.avatarType);

              // Save the variation choice locally for AI avatars
              if (selectedVariation && selectedVariation !== 'original') {
                saveUserAvatarVariation(user.id, selectedVariation);
              } else {
                // Clear any saved variation for original
                localStorage.removeItem(`avatar-variation-${user.id}`);
              }

              console.log('🤖 Calling updateUser with:', updatedResp);
              updateUser(updatedResp);

              console.log('🤖 Calling onSave with:', 'ai_generated', updatedResp);
              onSave('ai_generated', updatedResp);

              addSuccessMessage(t('AI avatar saved successfully!'));
              setIsSaving(false);
              onClose();
            },
            error: resp => {
              addErrorMessage(t('Failed to save AI avatar. Please try again.'));
              setIsSaving(false);
            },
          });
        };

        reader.onerror = () => {
          addErrorMessage(t('Failed to process AI avatar image.'));
          setIsSaving(false);
        };

        reader.readAsDataURL(blob);
      } catch (fetchError) {
        console.error('🤖 Failed to fetch AI avatar image:', fetchError);
        addErrorMessage(t('Failed to save AI avatar. Please try again.'));
        setIsSaving(false);
      }
    } else {
      console.log('🔍 Branch: No save action taken - no conditions met');
      console.log('🔍 Debug save conditions:', {
        'selectedMode === upload && uploadedFile':
          selectedMode === 'upload' && uploadedFile,
        'selectedMode === upload && previewUrl && !uploadedFile':
          selectedMode === 'upload' && previewUrl && !uploadedFile,
        'selectedMode === initials': selectedMode === 'initials',
        'selectedMode === ai && generatedAvatarUrl':
          selectedMode === 'ai' && generatedAvatarUrl,
        selectedMode,
        uploadedFile: !!uploadedFile,
        previewUrl: !!previewUrl,
        generatedAvatarUrl: !!generatedAvatarUrl,
      });
    }

    console.log('🔍 Save function completed');
  };

  const renderAvatarPreview = () => {
    // eslint-disable-next-line no-console
    console.log('🔍 Preview state:', {
      selectedMode,
      selectedInitialsColor,
      selectedVariation,
      generatedAvatarUrl,
      isGenerating,
      uploadedFile: !!uploadedFile,
      previewUrl: !!previewUrl,
    });

    if (selectedMode === 'initials') {
      console.log('🔍 Initials mode - selectedColor:', selectedInitialsColor);

      // Create a user object that forces letter avatar display
      const initialsUser = {
        ...user,
        avatar: {
          ...user.avatar,
          avatarType: 'letter_avatar' as const,
          avatarUrl: null, // Force no uploaded image
          avatarUuid: user.avatar?.avatarUuid || null,
        },
      };

      if (selectedInitialsColor === 'original') {
        return <UserAvatar user={initialsUser} size={150} />;
      }
      return (
        <TopAvatarWrapper backgroundColor={selectedInitialsColor}>
          <UserAvatar user={initialsUser} size={150} />
        </TopAvatarWrapper>
      );
    }

    if (selectedMode === 'upload' && previewUrl && selectedVariation) {
      const variation = backgroundVariations.find(v => v.id === selectedVariation);

      if (variation?.backgroundImage) {
        return (
          <AvatarWithBackground
            backgroundImage={variation.backgroundImage}
            patternColor={variation.patternColor}
            size={150}
          >
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
      if (isGenerating) {
        return (
          <BlankAvatar>
            <SpinningIcon>
              <IconStar size="xl" />
            </SpinningIcon>
            <GeneratingText>{t('Making magic...')}</GeneratingText>
          </BlankAvatar>
        );
      }

      if (generatedAvatarUrl) {
        console.log('🤖 Rendering AI avatar preview with URL:', generatedAvatarUrl);

        // Show AI avatar with selected background variation
        const variation = backgroundVariations.find(v => v.id === selectedVariation);

        if (variation?.backgroundImage) {
          console.log('🤖 Rendering AI avatar with background:', variation.id);
          return (
            <AvatarWithBackground
              backgroundImage={variation.backgroundImage}
              patternColor={variation.patternColor}
              size={150}
            >
              <PreviewAvatar
                src={generatedAvatarUrl}
                alt={t('Generated Avatar')}
                style={{filter: variation.filter}}
              />
            </AvatarWithBackground>
          );
        }

        console.log('🤖 Rendering plain AI avatar preview');
        return <PreviewAvatar src={generatedAvatarUrl} alt={t('Generated Avatar')} />;
      }

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
                <UserAvatar
                  user={{
                    ...user,
                    avatar: {
                      ...user.avatar,
                      avatarType: 'letter_avatar' as const,
                      avatarUrl: null,
                      avatarUuid: user.avatar?.avatarUuid || null,
                    },
                  }}
                  size={120}
                />
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
                    <UserAvatar
                      user={{
                        ...user,
                        avatar: {
                          ...user.avatar,
                          avatarType: 'letter_avatar' as const,
                          avatarUrl: null,
                          avatarUuid: user.avatar?.avatarUuid || null,
                        },
                      }}
                      size={120}
                      title={`Background: ${color}`}
                    />
                  </InitialsAvatarWrapper>
                </AvatarOption>
              ))}
            </ColorGrid>
          </InitialsSection>
        );

      case 'upload':
        console.log(
          '🔍 Upload mode - uploadedFile:',
          !!uploadedFile,
          'previewUrl:',
          !!previewUrl
        );
        return uploadedFile || previewUrl ? (
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
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedVariation(variation.id);
                  }}
                >
                  {variation.backgroundImage ? (
                    <AvatarWithBackground
                      backgroundImage={variation.backgroundImage}
                      patternColor={variation.patternColor}
                    >
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
                disabled={isGenerating}
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
                      if (isGenerating) return;
                      setSelectedEnhancements(prev =>
                        prev.includes(option.id)
                          ? prev.filter(id => id !== option.id)
                          : [...prev, option.id]
                      );
                    }}
                    title={option.description}
                    disabled={isGenerating}
                  >
                    {option.label}
                  </EnhancementChip>
                ))}
              </EnhancementsGrid>
            </EnhancementsSection>

            <GenerateButton
              size="md"
              priority="primary"
              disabled={
                isGenerating || (!aiPrompt.trim() && selectedEnhancements.length === 0)
              }
              onClick={generateAIAvatar}
            >
              {isGenerating ? t('Generating...') : t('Generate AI Avatar')}
            </GenerateButton>

            {/* Show used prompt if AI avatar was generated */}
            {usedPrompt && (
              <UsedPromptSection>
                <FormLabel>{t('Used Prompt')}</FormLabel>
                <UsedPromptText>{usedPrompt}</UsedPromptText>
              </UsedPromptSection>
            )}
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
            onChange={(value: string) => {
              const mode = value as AvatarMode;
              console.log('🔄 Switching mode from', selectedMode, 'to', mode);
              setSelectedMode(mode);

              // Clear AI state when switching away from AI mode
              if (mode !== 'ai') {
                console.log('🔄 Clearing AI state');
                setGeneratedAvatarUrl(null);
                setUsedPrompt(null);
                setAiPrompt('');
                setIsGenerating(false);
              }

              // Clear upload state when switching away from upload mode
              if (mode !== 'upload') {
                console.log('🔄 Clearing upload state');
                setUploadedFile(null);
                // Don't clear previewUrl if switching to upload mode with existing image
              }
            }}
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
        <Tooltip
          title={
            isSaving
              ? t('Saving your avatar...')
              : isGenerating
                ? t('Please wait while your AI avatar is being generated')
                : selectedMode === 'upload' && !uploadedFile && !previewUrl
                  ? t('Upload a photo first')
                  : selectedMode === 'ai' && !generatedAvatarUrl
                    ? t('Generate an AI avatar first')
                    : t('Save your avatar changes')
          }
          disabled={
            !isSaving &&
            !isGenerating &&
            !(selectedMode === 'upload' && !uploadedFile && !previewUrl) &&
            !(selectedMode === 'ai' && !generatedAvatarUrl)
          }
        >
          <Button
            onClick={() => {
              console.log('🚨 SAVE BUTTON CLICKED!');
              console.log('🚨 Current state:', {
                selectedMode,
                uploadedFile: !!uploadedFile,
                previewUrl: !!previewUrl,
                selectedVariation,
                selectedInitialsColor,
                isSaving,
                generatedAvatarUrl,
                isGenerating,
              });
              handleSave();
            }}
            priority="primary"
            disabled={isSaving || isGenerating}
          >
            {t('Save')}
          </Button>
        </Tooltip>
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
    background: ${p => p.theme.purple100};
    color: ${p => p.theme.purple300};
  }
`;

const UploadAnotherText = styled('span')`
  font-size: ${p => p.theme.fontSize.xs};
  font-weight: ${p => p.theme.fontWeight.bold};
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
  font-weight: ${p => p.theme.fontWeight.bold};
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
  font-weight: ${p => p.theme.fontWeight.bold};
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
  /* Target the SVG fill for top avatar - multiple selectors for robustness */
  svg rect {
    fill: ${p => p.backgroundColor} !important;
  }

  /* Target all possible SVG elements */
  svg circle {
    fill: ${p => p.backgroundColor} !important;
  }

  svg path {
    fill: ${p => p.backgroundColor} !important;
  }

  /* Target the entire SVG if needed */
  svg {
    background-color: ${p => p.backgroundColor};
    border-radius: 50%;
  }

  /* Fallback: if SVG targeting fails, add background to the wrapper */
  background-color: ${p => p.backgroundColor};
  border-radius: 50%;
  overflow: hidden;

  /* Ensure the avatar fits properly */
  display: flex;
  align-items: center;
  justify-content: center;
  width: 150px;
  height: 150px;
`;

const BlankAvatar = styled('div')`
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.gray200};
  background: ${p => p.theme.backgroundSecondary};
  height: 150px;
  width: 150px;
  border: 2px dashed ${p => p.theme.border};
  gap: ${space(1)};
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

const AvatarWithBackground = styled('div')<{
  backgroundImage?: string;
  patternColor?: string;
  size?: number;
}>`
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

  /* Background behind the avatar */
  background: ${p => {
    if (!p.backgroundImage) return 'none';
    // Check if it's a gradient (starts with linear-gradient)
    if (p.backgroundImage.startsWith('linear-gradient')) {
      return p.backgroundImage;
    }
    // Check if it's a solid color (starts with #)
    if (p.backgroundImage.startsWith('#')) {
      return p.backgroundImage;
    }
    // For pattern colors, use solid color background
    if (p.patternColor) {
      return p.patternColor;
    }
    // Otherwise it's a URL (photo background)
    return `url(${p.backgroundImage})`;
  }};
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;

  /* White background with colored SVG pattern */
  ${p =>
    p.patternColor &&
    p.backgroundImage &&
    `
    /* Colored background based on the specific pattern */
    background: ${p.patternColor} !important;

    &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
      background-image: url(${p.backgroundImage});
    background-size: cover;
    background-position: center;
      background-repeat: no-repeat;
    border-radius: 50%;
      z-index: 0;

      /* Make SVG pattern visible with color */
      mix-blend-mode: normal;
      opacity: 1;

      /* Just show the SVG pattern as-is without color manipulation */
    }
  `}
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

const EnhancementChip = styled('div')<{isSelected: boolean; disabled?: boolean}>`
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
  font-weight: ${p => p.theme.fontWeight.bold};
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

const GeneratingText = styled('div')`
  margin-top: ${space(1)};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  text-align: center;
`;

const SpinningIcon = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  animation: spin 2s linear infinite;

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const UsedPromptSection = styled('div')`
  margin-top: ${space(2)};
  padding: ${space(1.5)};
  background: ${p => p.theme.purple100};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.purple200};
`;

const UsedPromptText = styled('div')`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.purple400};
  font-style: italic;
  line-height: 1.3;
  opacity: 0.8;
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
