import {Fragment, useEffect} from 'react';
import {useTheme} from '@emotion/react';

import {
  type BreadcrumbListProps,
  BreadcrumbList,
  type BreadcrumbTitleItem,
} from '@sentry/scraps/breadcrumbList';
import {Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';

import {isSeerExplorerEnabled} from 'sentry/utils/seer/isSeerExplorerEnabled';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AskSeerButton} from 'sentry/views/seerExplorer/components/askSeerButton';

import {
  PRIMARY_HEADER_HEIGHT,
  PRIMARY_HEADER_TITLE_MIN_WIDTH,
  TOP_BAR_HEIGHT_CSS_VAR,
} from './constants';
import {
  TopBarFeedbackButton,
  type TopBarFeedbackButtonProps,
} from './topBarFeedbackButton';
import {TopBarSlots} from './topBarSlot';
import {useTopOffset} from './useTopOffset';

type TopBarSlotProps =
  | {
      name: 'breadcrumbs';
      title: BreadcrumbTitleItem;
      children?: never;
      items?: BreadcrumbListProps['items'];
    }
  | ({
      name: 'feedback';
      children?: never;
      title?: never;
    } & TopBarFeedbackButtonProps)
  | {
      children: React.ReactNode;
      name: 'search' | 'actions';
      title?: never;
    };

function TopBarSlot(props: TopBarSlotProps) {
  if (props.name === 'breadcrumbs') {
    return (
      <Fragment>
        {props.items && props.items.length > 0 && (
          <TopBarSlots name="breadcrumbs">
            <BreadcrumbList items={props.items} />
          </TopBarSlots>
        )}
        <TopBarSlots name="title">
          <BreadcrumbList.Title item={props.title} />
        </TopBarSlots>
      </Fragment>
    );
  }

  if (props.name === 'feedback') {
    return (
      <TopBarSlots name="feedback">
        <TopBarFeedbackButton
          feedbackOptions={props.feedbackOptions}
          aria-label={props['aria-label']}
        />
      </TopBarSlots>
    );
  }

  return <TopBarSlots name={props.name}>{props.children}</TopBarSlots>;
}

function TopBarContent() {
  const theme = useTheme();
  const {topBarTop, pageContentTop} = useTopOffset();

  const organization = useOrganization({allowNull: true});

  useEffect(() => {
    document.documentElement.style.setProperty(TOP_BAR_HEIGHT_CSS_VAR, pageContentTop);
    return () => {
      document.documentElement.style.removeProperty(TOP_BAR_HEIGHT_CSS_VAR);
    };
  }, [pageContentTop]);

  return (
    <Flex
      as="header"
      height={`${PRIMARY_HEADER_HEIGHT}px`}
      justify="between"
      background="secondary"
      align="center"
      gap="sm"
      padding={{'screen:sm': '0 lg', 'screen:md': '0 xl'}}
      position="sticky"
      borderBottom="primary"
      top={topBarTop}
      style={{
        zIndex: theme.zIndex.sidebarPanel - 1,
      }}
    >
      <SizeProvider size="sm">
        {/*
         * Breadcrumbs and the title use separate internal outlets.
         * BreadcrumbList.Title supplies the single <h1> and keeps page-title
         * graphics, pagination, and actions outside the heading.
         *
         * The title occupies the remaining inline space (the header is
         * justify="between", so this absorbs the empty middle; content stays
         * left-aligned and actions stay pinned right). This is required by any
         * title-slot child that establishes a container query.
         */}
        <Flex
          align="center"
          gap="sm"
          minWidth="0"
          flex={`1 1 ${PRIMARY_HEADER_TITLE_MIN_WIDTH}px`}
          containerType="inline-size"
        >
          <TopBarSlots.Outlet name="breadcrumbs">
            {(props, hasConsumers) =>
              hasConsumers ? (
                <Flex {...props} align="center" gap="sm" minWidth="0" flex="0 1 auto" />
              ) : null
            }
          </TopBarSlots.Outlet>

          <TopBarSlots.Outlet name="title">
            {props => (
              <Flex {...props} align="center" gap="sm" minWidth="0" flexGrow={1} />
            )}
          </TopBarSlots.Outlet>
        </Flex>

        <Flex align="center" gap="sm">
          <TopBarSlots.Outlet name="search">
            {(props, hasConsumers) =>
              hasConsumers ? <Flex {...props} align="center" gap="sm" /> : null
            }
          </TopBarSlots.Outlet>

          <TopBarSlots.Outlet name="actions">
            {(props, hasConsumers) =>
              hasConsumers ? <Flex {...props} align="center" gap="sm" /> : null
            }
          </TopBarSlots.Outlet>

          {isSeerExplorerEnabled(organization) ? <AskSeerButton /> : null}

          <TopBarSlots.Outlet name="feedback">
            {props => (
              <Flex {...props}>
                {/* If no component registers a feedback button, show the default one */}
                <TopBarSlots.Fallback>
                  <TopBarFeedbackButton />
                </TopBarSlots.Fallback>
              </Flex>
            )}
          </TopBarSlots.Outlet>
        </Flex>
      </SizeProvider>
    </Flex>
  );
}

export const TopBar = Object.assign(TopBarContent, {
  Slot: Object.assign(TopBarSlot, {
    Provider: TopBarSlots.Provider,
    Outlet: TopBarSlots.Outlet,
    Fallback: TopBarSlots.Fallback,
    useSlotOutletRef: TopBarSlots.useSlotOutletRef,
  }),
});
