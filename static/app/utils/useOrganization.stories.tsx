import StructuredEventData, {StructuredData} from 'sentry/components/structuredEventData';
import storyBook from 'sentry/stories/storyBook';
import useOrganization from 'sentry/utils/useOrganization';

export default storyBook('useOrganization', story => {
  story('useOrganization - via StructuredEventData', () => {
    const org = useOrganization();
    return <StructuredEventData data={org} forceDefaultExpand maxDefaultDepth={0} />;
  });

  story('useOrganization - via StructuredData', () => {
    const org = useOrganization();
    return (
      <StructuredData
        value={org}
        depth={0}
        maxDefaultDepth={0}
        meta={undefined}
        withAnnotatedText={false}
      />
    );
  });
});
