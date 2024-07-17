import StructuredEventData from 'sentry/components/structuredEventData';
import storyBook from 'sentry/stories/storyBook';
import useOrganization from 'sentry/utils/useOrganization';

export default storyBook('useOrganization', story => {
  story('useOrganization - via StructuredEventData', () => {
    const org = useOrganization();
    return <StructuredEventData data={org} />;
  });
});
