import {Fragment} from 'react';
import styled from '@emotion/styled';

import {PanelTable} from 'sentry/components/panels/panelTable';
import {
  IconAdd,
  IconChevron,
  IconClock,
  IconClose,
  IconDelete,
  IconDocs,
  IconEdit,
  IconOpen,
  IconStar,
  IconSubtract,
} from 'sentry/icons';

const FixedWidth = styled('div')`
  max-width: 800px;
`;

interface CTAItem {
  ctaName: string;
  description: string;
  icon: React.ReactNode;
}

const CTA_RECOMENDATIONS: CTAItem[] = [
  {
    icon: <IconAdd isCircled />,
    ctaName: 'Create',
    description: 'Spawn something from nothing',
  },
  {
    icon: <IconAdd isCircled />,
    ctaName: 'Add',
    description: 'Append another thing in the group',
  },
  {icon: <IconDelete />, ctaName: 'Delete', description: 'Destroy thing in the group'},
  {
    icon: <IconSubtract isCircled />,
    ctaName: 'Remove',
    description: 'Disconnect thing in the group',
  },
  {
    icon: null,
    ctaName: 'Manage',
    description: 'Broader meaning, includes bulk order, add, remove, etc.',
  },
  {
    icon: <IconEdit />,
    ctaName: 'Edit',
    description: 'Modifies fundamental attribute of the thing',
  },
  {
    icon: <IconOpen />,
    ctaName: 'Open in [Product]',
    description: 'Leaves existing view and goes to another product',
  },
  {
    icon: <IconClose isCircled />,
    ctaName: 'Close',
    description: 'Potentially reopen this again later',
  },
  {
    icon: <IconDocs />,
    ctaName: 'Read Docs',
    description: 'Sim to Open in but always goes to Sentry Docs',
  },
  {
    icon: null,
    ctaName: 'More [Samples]',
    description: 'See more samples of the same thing',
  },
  {
    icon: null,
    ctaName: 'Show More',
    description: 'Accordions down to reveal more content',
  },
  {
    icon: <IconChevron direction="down" />,
    ctaName: 'Expand',
    description: 'Content is completely hidden except for title',
  },
  {
    icon: <IconChevron direction="up" />,
    ctaName: 'Collapse',
    description: 'Content is completely shown and need to hide except title',
  },
  {icon: null, ctaName: 'Dismiss', description: 'Get rid of forever'},
  {
    icon: <IconClock />,
    ctaName: 'Remind Me Later',
    description: 'Pop something up again later',
  },
  {
    icon: <IconStar />,
    ctaName: 'Pin/Bookmark/Star',
    description: 'Favoriting/saving something',
  },
];

export default function CTAs() {
  return (
    <FixedWidth>
      <h3>Call to Action recommendations</h3>
      <p>Here is some recomended iconography to use with call to actions.</p>
      <PanelTable headers={['Icon', 'CTA', 'Meaning']}>
        {CTA_RECOMENDATIONS.map(({icon, ctaName, description}) => {
          return (
            <Fragment key={ctaName}>
              <div>{icon}</div>
              <div>{ctaName}</div>
              <div>{description}</div>
            </Fragment>
          );
        })}
      </PanelTable>
    </FixedWidth>
  );
}
