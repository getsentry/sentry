import styled from '@emotion/styled';

import {DataSection} from 'app/components/events/styles';
import space from 'app/styles/space';

import Screenshot from './screenshot';
import Tags from './tags';

type Props = Omit<React.ComponentProps<typeof Tags>, 'projectSlug'> & {
  projectId: string;
};

function EventTagsAndScreenshots({
  projectId: projectSlug,
  organization,
  ...props
}: Props) {
  return (
    <Wrapper>
      <Screenshot {...props} projectSlug={projectSlug} orgSlug={organization.slug} />
      <Tags {...props} projectSlug={projectSlug} organization={organization} />
    </Wrapper>
  );
}

export default EventTagsAndScreenshots;

const Wrapper = styled(DataSection)`
  display: grid;
  grid-gap: ${space(3)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    && {
      padding: 0;
      border: 0;
    }
  }

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-bottom: ${space(2)};
    grid-template-columns: auto 1fr;
    grid-gap: ${space(4)};

    > *:first-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
  }
`;
