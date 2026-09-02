import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {useDimensions} from 'sentry/utils/useDimensions';
import type {AuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';

import {OrganizationAuth} from './organizationAuth';
import {OrganizationSlugInput} from './organizationSlugInput';

interface OrganizationSwitcherProps {
  authOrganization: AuthOrganization | undefined;
  isInputVisible: boolean;
  onCancel: () => void;
  onClear: (() => void) | undefined;
  onOpen: () => void;
  onSelect: (organizationSlug: string) => void;
}

export function OrganizationSwitcher({
  authOrganization,
  isInputVisible,
  onCancel,
  onClear,
  onOpen,
  onSelect,
}: OrganizationSwitcherProps) {
  const theme = useTheme();
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  // The callback ref triggers a render when the grid mounts, while this stable
  // ref-shaped object lets useDimensions attach its observer to that grid.
  const elementRef = useMemo(() => ({current: element}), [element]);
  const {height} = useDimensions({elementRef});

  return (
    <MotionContainer
      initial={false}
      animate={height ? {height} : undefined}
      transition={theme.motion.framer.spring.moderate}
    >
      <MotionGrid
        ref={gridElement => setElement(gridElement as HTMLDivElement | null)}
        columns="1fr"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {authOrganization ? (
            <MotionContainer
              key="organization"
              area="1 / 1"
              initial={{opacity: 0, y: -5}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: 5}}
              transition={theme.motion.framer.smooth.moderate}
            >
              <OrganizationAuth authOrganization={authOrganization} onClear={onClear} />
            </MotionContainer>
          ) : isInputVisible ? (
            <MotionContainer
              key="organization-input"
              area="1 / 1"
              initial={{opacity: 0, y: -10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: 10}}
              transition={theme.motion.framer.smooth.moderate}
            >
              <OrganizationSlugInput onCancel={onCancel} onSelect={onSelect} />
            </MotionContainer>
          ) : (
            <MotionFlex
              key="organization-button"
              area="1 / 1"
              direction="column"
              width="100%"
              initial={{opacity: 0, y: -10}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: 10}}
              transition={theme.motion.framer.smooth.moderate}
            >
              <Button onClick={onOpen}>{t('Organization SSO')}</Button>
            </MotionFlex>
          )}
        </AnimatePresence>
      </MotionGrid>
    </MotionContainer>
  );
}

const MotionContainer = motion.create(Container);
const MotionFlex = motion.create(Flex);
const MotionGrid = motion.create(Grid);
