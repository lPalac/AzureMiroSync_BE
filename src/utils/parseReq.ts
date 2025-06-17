export const parseReq = (req: any) => {
  let body;
  if (Buffer.isBuffer(req.body)) {
    const text = req.body.toString("utf-8");
    body = JSON.parse(text);
  } else if (typeof req.body === "string") {
    body = JSON.parse(req.body);
  } else {
    body = req.body;
  }
  return body;
};
