Dashboard

- New enquiries
- Quotes pending
- Orders in production
- Payments due
- Follow-ups due
- Sales this month
- Top customers


Schema list

orders
- customer id
- employee id
- item id
- status
- quantity
- paper type
- size
- delivered
- quotation id

employee
- first name
- last name
- email
- employee type

customer
- name
- conatact
- email
- GST number
- company name
- delivery address: JSON
    - address line 1
    - address line 2
    - city
    - pincode

item
- name
- printing prices per sheet
- designing charges per sheet
- other product specific configuration

quotation (speculative, create more fields on your own)
- price
- splitup
- tax