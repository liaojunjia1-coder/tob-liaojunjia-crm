import { buildCustomerInsight, searchCompany } from "../../src/aiAdvisor.js";

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = readBody(req);
  const customer = body.customer;
  if (!customer?.company) {
    res.status(400).json({ error: "请先选择一个客户。" });
    return;
  }

  const webResults = await searchCompany(customer.company, customer.industry);
  res.status(200).json({
    insight: buildCustomerInsight(customer, body.data || {}, webResults),
  });
}
