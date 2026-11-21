
from scanner.receipt_parser import parse_receipt
from scanner.receipt_validator import validate_receipt

# Test 1: Table-style receipt
receipt1 = """Item Price Qty Total
Mutton biriyani 400 4 1600
Tandoori Roti X30 5 150
Chilly chicken 250 2 500
Chicken pepper 250 3 750
Sub-Total: = 3000
CGST: 2.5% %75
SGST: 2.5% %75
Mode: Cash Total: = 3150"""

# Test 2: Quantity-first receipt
receipt2 = """2x Masala Dosa %538.080
3 x Veg Biryani %747.88
1 x Paneer Butter 7295.80
Masala
2 x Veg Biryani 7798.88
2 x Hakka Noodles 7878.80
1 x Butter Naan 7399.80
SUBTOTAL: %3,647.8@
CGST (9%): %328.23
SGST (9%): %328.23
TOTAL: 4,303.46"""

for number, receipt_text in enumerate(
    [receipt1, receipt2],
    start=1
):
    parsed = parse_receipt(receipt_text)

    validation = validate_receipt(
        parsed["items"],
        parsed["summary"]
    )

    print(f"\n{'=' * 40}")
    print(f"RECEIPT {number}")
    print("=" * 40)

    print("\nFOOD ITEMS:")
    for item in parsed["items"]:
        print(item)

    print("\nSUMMARY:")
    print(parsed["summary"])

    print("\nVALIDATION:")
    print(validation)
