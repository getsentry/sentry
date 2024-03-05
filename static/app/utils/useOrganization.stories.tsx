import ObjectInspector from 'sentry/components/objectInspector';
import StructuredEventData from 'sentry/components/structuredEventData';
import storyBook from 'sentry/stories/storyBook';
import useOrganization from 'sentry/utils/useOrganization';

export default storyBook('useOrganization', story => {
  story('useOrganization - via ObjectInspector', () => {
    const org = useOrganization();
    return <ObjectInspector data={org} expandLevel={3} />;
  });

  story('useOrganization - via StructuredEventData', () => {
    const org = useOrganization();
    return <StructuredEventData data={org} />;
  });
});
