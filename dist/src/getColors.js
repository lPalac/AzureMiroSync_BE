"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatusColor = void 0;
const getStatusColor = (status) => {
    switch (status) {
        case "To Do":
        case "Approved":
            return "#17BECF";
        case "New":
            return "#1F77B4";
        case "Committed":
        case "In Progress":
            return "#9467BD";
        case "Dev review":
            return "#FF7F0E";
        case "Blocked":
            return "#D62728";
        case "Done":
            return "#28A745";
        default:
            return "#7F7F7F";
    }
};
exports.getStatusColor = getStatusColor;
