// class GenericSummary extends React.Component {
//   static propTypes = {
//     data: PropTypes.object.isRequired,
//     unknownTitle: PropTypes.string.isRequired,
//   };

//   render() {
//     const data = this.props.data;

//     if (objectIsEmpty(data) || !data.name) {
//       return <NoSummary title={this.props.unknownTitle} />;
//     }

//     const className = generateClassName(data.name);

//     return (
//       <div className={`context-item ${className}`}>
//         <span className="context-item-icon" />
//         <h3>{data.name}</h3>
//         <p>
//           <strong>{t('Version:')}</strong> {data.version || t('Unknown')}
//         </p>
//       </div>
//     );
//   }
// }

import React from 'react';

type Props = {
  data: {};
};

const ContextSummaryGeneric = ({data}: Props) => {
  console.log('ContextSummaryGeneric', data);
  return null;
};

export default ContextSummaryGeneric;
