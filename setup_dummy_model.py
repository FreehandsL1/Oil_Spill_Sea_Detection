import torch
import segmentation_models_pytorch as smp

print("Generating dummy weights...")
model = smp.Unet(
    encoder_name="resnet34",
    encoder_weights=None, 
    in_channels=1, 
    classes=1
)
torch.save(model.state_dict(), 'unet_oil_spill.pth')
print("Done! unet_oil_spill.pth is now in your file explorer.")