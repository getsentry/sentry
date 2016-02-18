import SetShortIdsAction from '../views/requiredAdminActions/setShortIds';

const requiredAdminActions = {
  SET_SHORT_IDS: SetShortIdsAction
};

for (let key in requiredAdminActions) {
  requiredAdminActions[key].ID = key;
}

export default requiredAdminActions;
