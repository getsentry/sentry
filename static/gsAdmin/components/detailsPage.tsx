import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tag, type TagProps} from 'sentry/components/core/badge/tag';
import {Tooltip} from 'sentry/components/core/tooltip';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {space} from 'sentry/styles/space';

import type {openAdminConfirmModal} from 'admin/components/adminConfirmationModal';
import DropdownActions from 'admin/components/dropdownActions';
import PageHeader from 'admin/components/pageHeader';

export type ActionItem = {
  key: string;
  /**
   * Name of the action
   */
  name: string;
  /**
   * Triggered when the action is confirmed
   */
  onAction: (params: Record<string, any>) => void;
  /**
   * Aditional props for the openAdminConfirmModal call.
   *
   * Note that some defaults are provided to the openAdminConfirmModal and may
   * be overriden in this object.
   */
  confirmModalOpts?: Omit<Parameters<typeof openAdminConfirmModal>[0], 'onConfirm'>;
  /**
   * Is the action disabled?
   */
  disabled?: boolean;
  /**
   * The reason that the action is disabled
   */
  disabledReason?: string;
  /**
   * Help text under the action
   */
  help?: string;
  /**
   * Skips calling openAdminConfirmModal if set to true, onAction will be
   * immediately triggered with no parameters.
   */
  skipConfirmModal?: boolean;
  /**
   * If set to false will hide the item from the menu
   */
  visible?: boolean;
};

export type BadgeItem = {
  name: string;
  /**
   * A tooltip rendered on the badge
   */
  help?: React.ReactNode;
  /**
   * Tag type
   */
  level?: TagProps['variant'];
  /**
   * If set to false will hide the badge
   */
  visible?: boolean;
};

type SectionItem = {
  content: React.ReactElement;
  /**
   * Adds a heading to the panel. Does nothing when noPanel is set.
   */
  name?: string;
  /**
   * Disables padding within the panel
   */
  noPadding?: boolean;
  /**
   * Does not contain the section within a panel.
   *
   * Note that the name and padding will not be respected, as the content will
   * just be rendered
   */
  noPanel?: boolean;
  /**
   * If set to false will hide the section
   */
  visible?: boolean;
};

type Props = {
  /**
   * The name of the specific item we're looking at details of.
   */
  name: string;
  /**
   * The "parent" name of the details view. If you were looking at a specific
   * customer this would probably be "Customers"
   */
  rootName: string;
  /**
   * List of actions available on this view.
   */
  actions?: ActionItem[];
  /**
   * List of badges to display next to the title
   */
  badges?: BadgeItem[];
  /**
   * Breadcrumbs between the root and name in the details page title
   */
  crumbs?: React.ReactNode[];
  /**
   * List of sections to show. This is the primary content of the page
   */
  sections?: SectionItem[];
};

function DetailsPage({
  rootName,
  name,
  crumbs = [],
  actions = [],
  badges = [],
  sections = [],
}: Props) {
  return (
    <Fragment>
      <PageHeader
        title={rootName}
        breadcrumbs={[
          ...crumbs,
          <NameWithBadges key="page">
            {name}
            {badges
              .filter(badge => badge.visible !== false)
              .map(badge => (
                <Tooltip key={badge.name} disabled={!badge.help} title={badge.help}>
                  <Tag variant={badge.level ?? 'muted'}>{badge.name}</Tag>
                </Tooltip>
              ))}
          </NameWithBadges>,
        ]}
      >
        {actions.some(a => a.visible !== false) && (
          <DropdownActions actions={actions} label={`${rootName} Actions`} />
        )}
      </PageHeader>

      {sections
        .filter(section => section.visible !== false)
        .map((section, i) =>
          section.noPanel ? (
            <Fragment key={section.name ?? i}>{section.content}</Fragment>
          ) : (
            <Panel key={section.name ?? i}>
              {section.name && <PanelHeader>{section.name}</PanelHeader>}
              <ErrorBoundary>
                <SectionBody withPadding={!section.noPadding}>
                  {section.content}
                </SectionBody>
              </ErrorBoundary>
            </Panel>
          )
        )}
    </Fragment>
  );
}

const NameWithBadges = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const SectionBody = styled('div')<{withPadding?: boolean}>`
  ${p => p.withPadding && `padding: ${space(2)}`};
`;

export default DetailsPage;
