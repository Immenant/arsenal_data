"Type: 1mercian | Last Updated: 2025-12-31";
params ["_Arsenal"];
[_Arsenal, false] call ace_dragging_fnc_setDraggable;
[_Arsenal, false] call ace_dragging_fnc_setCarryable;
[_Arsenal,
  []
] call ace_arsenal_fnc_initBox;